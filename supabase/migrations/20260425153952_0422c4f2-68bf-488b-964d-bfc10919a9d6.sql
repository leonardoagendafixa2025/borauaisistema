-- Áreas de entrega por bairro
CREATE TABLE public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  neighborhood TEXT NOT NULL,
  city TEXT,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  min_order_value NUMERIC DEFAULT 0,
  estimated_time INTEGER DEFAULT 45,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_zones_restaurant ON public.delivery_zones(restaurant_id);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active delivery zones"
  ON public.delivery_zones FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff manage delivery zones"
  ON public.delivery_zones FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access delivery zones"
  ON public.delivery_zones FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_delivery_zones_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Combos / Promoções
CREATE TABLE public.product_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_combos_restaurant ON public.product_combos(restaurant_id);

CREATE TABLE public.product_combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_combo_items_combo ON public.product_combo_items(combo_id);

ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active combos"
  ON public.product_combos FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff manage combos"
  ON public.product_combos FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access combos"
  ON public.product_combos FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Public can view combo items"
  ON public.product_combo_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.product_combos c WHERE c.id = combo_id AND c.active = true));

CREATE POLICY "Restaurant staff manage combo items"
  ON public.product_combo_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.product_combos c WHERE c.id = combo_id AND has_restaurant_role(auth.uid(), c.restaurant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_combos c WHERE c.id = combo_id AND has_restaurant_role(auth.uid(), c.restaurant_id)));

CREATE POLICY "Super admins full access combo items"
  ON public.product_combo_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_product_combos_updated_at
  BEFORE UPDATE ON public.product_combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular zone ao pedido
ALTER TABLE public.orders ADD COLUMN delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL;