-- ========= NIGHTLIFE ACTS (line-up) =========
CREATE TABLE public.nightlife_acts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  artist_name TEXT NOT NULL,
  genre TEXT,
  description TEXT,
  image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nightlife_acts_restaurant_time ON public.nightlife_acts(restaurant_id, starts_at);

ALTER TABLE public.nightlife_acts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active acts"
  ON public.nightlife_acts FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff can manage acts"
  ON public.nightlife_acts FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access acts"
  ON public.nightlife_acts FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_nightlife_acts_updated_at
  BEFORE UPDATE ON public.nightlife_acts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= NIGHTLIFE HOUR DRINKS (drink da hora) =========
CREATE TABLE public.nightlife_hour_drinks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  product_id UUID,
  custom_name TEXT,
  custom_image_url TEXT,
  promo_price NUMERIC NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  highlight_text TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nightlife_drinks_restaurant_time ON public.nightlife_hour_drinks(restaurant_id, starts_at);

ALTER TABLE public.nightlife_hour_drinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active hour drinks"
  ON public.nightlife_hour_drinks FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff can manage hour drinks"
  ON public.nightlife_hour_drinks FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access hour drinks"
  ON public.nightlife_hour_drinks FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_nightlife_hour_drinks_updated_at
  BEFORE UPDATE ON public.nightlife_hour_drinks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= REALTIME =========
ALTER TABLE public.nightlife_acts REPLICA IDENTITY FULL;
ALTER TABLE public.nightlife_hour_drinks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nightlife_acts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nightlife_hour_drinks;