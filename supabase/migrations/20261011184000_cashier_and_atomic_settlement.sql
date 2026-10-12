-- Migration: Cashier shifts hardening (float, supplies, bleeds, blind close) and atomic table settlement
-- Description:
-- 1. Adds initial_cash, closed_by, closed_cash, expected_cash, cash_difference, notes to public.cashier_sessions.
-- 2. Creates public.cashier_movements (suprimentos e sangrias) with RLS.
-- 3. Creates public.close_table_settlement RPC for atomic, payment-verified table closing.

-- 1. Cashier sessions enhancements
ALTER TABLE public.cashier_sessions
ADD COLUMN IF NOT EXISTS initial_cash numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_by uuid,
ADD COLUMN IF NOT EXISTS closed_cash numeric,
ADD COLUMN IF NOT EXISTS expected_cash numeric,
ADD COLUMN IF NOT EXISTS cash_difference numeric,
ADD COLUMN IF NOT EXISTS notes text;

-- 2. Cashier movements table (suprimentos e sangrias)
CREATE TABLE IF NOT EXISTS public.cashier_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cashier_sessions(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('supply', 'bleed')), -- supply = suprimento (+), bleed = sangria (-)
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashier_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff can manage cashier movements"
ON public.cashier_movements FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access cashier movements"
ON public.cashier_movements FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cashier_movements_session ON public.cashier_movements(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashier_movements_restaurant ON public.cashier_movements(restaurant_id);

-- 3. Atomic Table Settlement RPC
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
BEGIN
  -- Security check: user must belong to restaurant or be super admin (if authenticated)
  IF auth.uid() IS NOT NULL AND NOT (
    has_restaurant_role(auth.uid(), _restaurant_id) OR has_role(auth.uid(), 'super_admin'::app_role)
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
        _restaurant_id, _table_id, _remaining, 1, _payment_method, 'Fechamento de Mesa', _user_id, true
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
