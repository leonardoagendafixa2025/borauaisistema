-- Migration: Security, RLS Hardening and Business Logic Corrections
-- Description:
-- 1. Fixes close_table_settlement RPC bypass for unauthenticated callers (P0)
-- 2. Restricts public.subscriptions INSERT policy to prevent free active status escalation
-- 3. Updates financial_transactions CHECK constraint to support 'partial_payment'
-- 4. Adds inventory deduction trigger for order items inserted into already active/completed orders

-- ========================================================
-- 1. HARDEN close_table_settlement RPC
-- ========================================================
CREATE OR REPLACE FUNCTION public.close_table_settlement(
  _table_id uuid,
  _restaurant_id uuid,
  _payment_method text DEFAULT NULL,
  _close_unpaid boolean DEFAULT false,
  _user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_orders numeric := 0;
  _total_paid numeric := 0;
  _remaining numeric := 0;
  _orders_count int := 0;
  _caller_id uuid;
BEGIN
  _caller_id := auth.uid();

  -- STRICT AUTH CHECK: Must be authenticated AND have restaurant role or super_admin
  IF _caller_id IS NULL OR NOT (
    has_restaurant_role(_caller_id, _restaurant_id) OR has_role(_caller_id, 'super_admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado.');
  END IF;

  -- 1. Ensure table belongs to restaurant
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_tables
    WHERE id = _table_id AND restaurant_id = _restaurant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mesa não encontrada ou não pertence ao restaurante.');
  END IF;

  -- 2. Sum active orders on this table (not cancelled or completed)
  SELECT COALESCE(SUM(total), 0), COUNT(id)
  INTO _total_orders, _orders_count
  FROM public.orders
  WHERE table_id = _table_id
    AND status NOT IN ('completed', 'cancelled');

  -- 3. Sum existing partial payments not yet closed
  SELECT COALESCE(SUM(amount), 0)
  INTO _total_paid
  FROM public.table_partial_payments
  WHERE table_id = _table_id
    AND closed = false;

  _remaining := GREATEST(0, _total_orders - _total_paid);

  -- 4. Check if there is an unpaid balance
  IF _remaining > 0.01 AND NOT _close_unpaid THEN
    IF _payment_method IS NOT NULL AND _payment_method <> '' THEN
      -- Record final payment for the remaining balance
      INSERT INTO public.table_partial_payments (
        restaurant_id, table_id, amount, people_count, payment_method, paid_by, created_by, closed
      ) VALUES (
        _restaurant_id, _table_id, _remaining, 1, _payment_method, 'Fechamento de Mesa', COALESCE(_caller_id, _user_id), true
      );

      -- Log financial transaction
      INSERT INTO public.financial_transactions (
        restaurant_id, amount, type, description
      ) VALUES (
        _restaurant_id, _remaining, 'order_revenue', 'Fechamento de mesa (' || _payment_method || ')'
      );
    ELSE
      -- Return warning with remaining balance
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'unpaid_balance',
        'remaining', _remaining,
        'total_orders', _total_orders,
        'total_paid', _total_paid
      );
    END IF;
  END IF;

  -- 5. Mark all partial payments closed
  UPDATE public.table_partial_payments
  SET closed = true
  WHERE table_id = _table_id AND closed = false;

  -- 6. Close table commands
  UPDATE public.table_commands
  SET status = 'closed', closed_at = now(), updated_at = now()
  WHERE table_id = _table_id AND status = 'open';

  -- 7. Close table sessions
  UPDATE public.table_sessions
  SET status = 'closed'
  WHERE table_id = _table_id AND status = 'active';

  -- 8. Complete open orders
  IF _orders_count > 0 THEN
    UPDATE public.orders
    SET status = 'completed',
        payment_status = 'paid',
        payment_method = COALESCE(payment_method, _payment_method, 'multiple')
    WHERE table_id = _table_id
      AND status NOT IN ('completed', 'cancelled');
  END IF;

  -- 9. Free table
  UPDATE public.restaurant_tables
  SET status = 'available'
  WHERE id = _table_id;

  RETURN jsonb_build_object(
    'success', true,
    'table_id', _table_id,
    'settled_amount', _remaining,
    'orders_closed', _orders_count
  );
END;
$$;

-- Revoke anon/public execution from RPC
REVOKE ALL ON FUNCTION public.close_table_settlement FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_table_settlement TO authenticated;

-- ========================================================
-- 2. HARDEN public.subscriptions INSERT POLICY
-- ========================================================
DROP POLICY IF EXISTS "Owner can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Owner can insert own trial subscription" ON public.subscriptions;

CREATE POLICY "Owner can insert own trial subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.id = subscriptions.restaurant_id
      AND restaurants.owner_id = auth.uid()
  )
  AND (status IN ('trialing', 'trial', 'incomplete'))
);

-- ========================================================
-- 3. EXTEND financial_transactions TYPE CONSTRAINT
-- ========================================================
ALTER TABLE public.financial_transactions 
  DROP CONSTRAINT IF EXISTS financial_transactions_type_check;

ALTER TABLE public.financial_transactions 
  ADD CONSTRAINT financial_transactions_type_check 
  CHECK (type IN ('order_revenue', 'subscription_payment', 'platform_fee', 'refund', 'partial_payment'));

-- ========================================================
-- 4. INVENTORY DEDUCTION ON ORDER ITEM INSERT
-- ========================================================
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_status text;
  _stock_deducted boolean;
BEGIN
  SELECT status, stock_deducted INTO _order_status, _stock_deducted
  FROM public.orders
  WHERE id = NEW.order_id;

  -- If the order is already in an active or completed state
  IF _order_status IN ('accepted', 'preparing', 'ready', 'waiting_pickup', 'delivering', 'completed') THEN
    UPDATE public.inventory_items ii
    SET current_stock = ii.current_stock - (pi.quantity_used * NEW.qty)
    FROM public.product_ingredients pi
    WHERE pi.product_id = NEW.product_id
      AND pi.inventory_item_id = ii.id;

    -- Ensure orders.stock_deducted reflects that stock deduction has taken place
    IF COALESCE(_stock_deducted, false) = false THEN
      UPDATE public.orders SET stock_deducted = true WHERE id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deduct_stock_on_order_item_trigger ON public.order_items;
CREATE TRIGGER deduct_stock_on_order_item_trigger
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order_item_insert();
