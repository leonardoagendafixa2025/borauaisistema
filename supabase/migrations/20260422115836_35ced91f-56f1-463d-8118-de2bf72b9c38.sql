-- 1. Add is_quick_sale flag to products (marks favorites for the quick-sale grid)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_quick_sale boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_quick_sale
  ON public.products (restaurant_id, is_quick_sale)
  WHERE is_quick_sale = true;

-- 2. Add quick-sale toggle + default commission % to restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS quick_sale_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quick_sale_commission_percent numeric NOT NULL DEFAULT 0;

-- 3. Track which staff member served / sold the order (for ranking + commission)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS served_by uuid;

CREATE INDEX IF NOT EXISTS idx_orders_served_by
  ON public.orders (restaurant_id, served_by, created_at DESC)
  WHERE served_by IS NOT NULL;

-- 4. Add 'quick_sale' to the order_type enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_type' AND e.enumlabel = 'quick_sale'
  ) THEN
    ALTER TYPE public.order_type ADD VALUE 'quick_sale';
  END IF;
END$$;