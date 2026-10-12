-- Migration: Backend price validation, options recalculation and tamper-proofing for orders
-- Description:
-- 1. Enforces catalog price integrity on order_items linked to products.
-- 2. Automatically sums product options prices.
-- 3. Automatically updates orders subtotal and total whenever order_items are inserted, updated, or removed.

-- 1. Function to validate item unit price and total price before insert/update
CREATE OR REPLACE FUNCTION public.validate_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _catalog_price numeric;
  _opts_total numeric := 0;
  _opt_elem jsonb;
BEGIN
  -- If linked to a product, enforce catalog unit price
  IF NEW.product_id IS NOT NULL THEN
    SELECT price INTO _catalog_price
    FROM public.products
    WHERE id = NEW.product_id;

    IF _catalog_price IS NOT NULL AND _catalog_price > 0 THEN
      -- If client provided lower unit_price (tampering attempt), force catalog price
      IF NEW.unit_price IS NULL OR NEW.unit_price < _catalog_price THEN
        NEW.unit_price := _catalog_price;
      END IF;
    END IF;
  END IF;

  -- Sum options prices if present in JSON array
  IF NEW.options IS NOT NULL AND jsonb_typeof(to_jsonb(NEW.options)) = 'array' THEN
    FOR _opt_elem IN SELECT * FROM jsonb_array_elements(to_jsonb(NEW.options)) LOOP
      _opts_total := _opts_total + COALESCE((_opt_elem->>'price')::numeric, 0);
    END LOOP;
  END IF;

  -- Ensure valid quantity
  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN
    NEW.qty := 1;
  END IF;

  -- Ensure total_price is at least (unit_price + options) * qty
  IF NEW.total_price IS NULL OR NEW.total_price < ((COALESCE(NEW.unit_price, 0) + _opts_total) * NEW.qty) THEN
    NEW.total_price := (COALESCE(NEW.unit_price, 0) + _opts_total) * NEW.qty;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item_price ON public.order_items;
CREATE TRIGGER trg_validate_order_item_price
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_item_price();

-- 2. Function to recalculate order subtotal and total after order_items changes
CREATE OR REPLACE FUNCTION public.recalculate_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_order_id uuid;
  _items_subtotal numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _target_order_id := OLD.order_id;
  ELSE
    _target_order_id := NEW.order_id;
  END IF;

  SELECT COALESCE(SUM(total_price), 0)
  INTO _items_subtotal
  FROM public.order_items
  WHERE order_id = _target_order_id;

  -- Recalculate order subtotal and total if items exist
  IF _items_subtotal > 0 THEN
    UPDATE public.orders
    SET subtotal = _items_subtotal,
        total = GREATEST(0, _items_subtotal + COALESCE(delivery_fee, 0) - COALESCE(discount, 0)),
        updated_at = now()
    WHERE id = _target_order_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_order_totals ON public.order_items;
CREATE TRIGGER trg_recalculate_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_order_totals();
