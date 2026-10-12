-- Migration: Fix inventory deduction for skip-kitchen (drink) orders and restore on cancellation
-- Description:
-- 1. Adds stock_deducted boolean to public.orders to guarantee idempotent stock handling.
-- 2. Upgrades deduct_stock_on_order trigger function to:
--    - Deduct stock when an order is accepted, ready, delivering, or completed (including drink orders that skip kitchen).
--    - Restore stock when an order is cancelled after having its stock deducted.
--    - Auto-update products sold_out flag based on current_stock vs min_stock.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

-- Backfill completed and active historical orders so their stock won't be re-deducted
UPDATE public.orders
SET stock_deducted = true
WHERE status IN ('accepted', 'preparing', 'ready', 'waiting_pickup', 'delivering', 'completed')
  AND stock_deducted = false;

-- Replace trigger function with comprehensive deduction and restoration logic
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) DEDUCTION: When order transitions to any active/ready/completed state and stock was not yet deducted
  IF (NEW.status IN ('accepted', 'preparing', 'ready', 'waiting_pickup', 'delivering', 'completed'))
     AND (COALESCE(OLD.stock_deducted, false) = false) THEN

    -- Deduct inventory based on recipes / ingredients
    UPDATE public.inventory_items ii
    SET current_stock = ii.current_stock - (pi.quantity_used * oi.qty)
    FROM public.order_items oi
    JOIN public.product_ingredients pi ON pi.product_id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND pi.inventory_item_id = ii.id;

    -- Mark products as sold_out if any ingredient is now below or equal to min_stock
    UPDATE public.products p
    SET sold_out = true
    WHERE p.restaurant_id = NEW.restaurant_id
      AND p.sold_out = false
      AND EXISTS (
        SELECT 1 FROM public.product_ingredients pi2
        JOIN public.inventory_items ii2 ON ii2.id = pi2.inventory_item_id
        WHERE pi2.product_id = p.id
          AND ii2.current_stock <= ii2.min_stock
      );

    NEW.stock_deducted := true;
  END IF;

  -- 2) RESTORATION: When order is cancelled after stock was previously deducted
  IF (NEW.status = 'cancelled')
     AND (COALESCE(OLD.stock_deducted, false) = true) THEN

    -- Restore inventory
    UPDATE public.inventory_items ii
    SET current_stock = ii.current_stock + (pi.quantity_used * oi.qty)
    FROM public.order_items oi
    JOIN public.product_ingredients pi ON pi.product_id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND pi.inventory_item_id = ii.id;

    -- Re-enable products (unmark sold_out) if all ingredients are now above min_stock
    UPDATE public.products p
    SET sold_out = false
    WHERE p.restaurant_id = NEW.restaurant_id
      AND p.sold_out = true
      AND NOT EXISTS (
        SELECT 1 FROM public.product_ingredients pi3
        JOIN public.inventory_items ii3 ON ii3.id = pi3.inventory_item_id
        WHERE pi3.product_id = p.id
          AND ii3.current_stock <= ii3.min_stock
      );

    NEW.stock_deducted := false;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop previous AFTER UPDATE trigger and register BEFORE UPDATE trigger
DROP TRIGGER IF EXISTS deduct_stock_trigger ON public.orders;
CREATE TRIGGER deduct_stock_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order();
