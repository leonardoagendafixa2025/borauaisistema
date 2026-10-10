
-- Inventory items (raw ingredients/supplies)
CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  supplier text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link products to ingredients
CREATE TABLE public.product_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_used numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, inventory_item_id)
);

-- RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

-- Inventory items policies
CREATE POLICY "Restaurant staff can manage inventory"
  ON public.inventory_items FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access inventory"
  ON public.inventory_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Product ingredients policies
CREATE POLICY "Restaurant staff can manage product ingredients"
  ON public.product_ingredients FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_ingredients.product_id
    AND has_restaurant_role(auth.uid(), p.restaurant_id)
  ));

CREATE POLICY "Super admins full access product ingredients"
  ON public.product_ingredients FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Updated_at triggers
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to deduct stock when order is completed
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only deduct when status changes to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'new' THEN
    UPDATE inventory_items ii
    SET current_stock = ii.current_stock - (pi.quantity_used * oi.qty)
    FROM order_items oi
    JOIN product_ingredients pi ON pi.product_id = oi.product_id
    WHERE oi.order_id = NEW.id
    AND pi.inventory_item_id = ii.id;

    -- Auto mark products as sold_out if any ingredient is below min
    UPDATE products p
    SET sold_out = true
    WHERE p.restaurant_id = NEW.restaurant_id
    AND p.sold_out = false
    AND EXISTS (
      SELECT 1 FROM product_ingredients pi2
      JOIN inventory_items ii2 ON ii2.id = pi2.inventory_item_id
      WHERE pi2.product_id = p.id
      AND ii2.current_stock <= ii2.min_stock
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deduct_stock_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order();

-- Indexes
CREATE INDEX idx_inventory_items_restaurant ON public.inventory_items(restaurant_id);
CREATE INDEX idx_product_ingredients_product ON public.product_ingredients(product_id);
CREATE INDEX idx_product_ingredients_inventory ON public.product_ingredients(inventory_item_id);
