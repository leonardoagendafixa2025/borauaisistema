CREATE TABLE public.restaurant_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  link_type TEXT NOT NULL DEFAULT 'none',
  link_target TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_banners_link_type_check CHECK (link_type IN ('none','category','product','external'))
);

CREATE INDEX idx_restaurant_banners_restaurant ON public.restaurant_banners (restaurant_id, sort_order);
CREATE INDEX idx_restaurant_banners_active ON public.restaurant_banners (restaurant_id, active) WHERE active = true;

ALTER TABLE public.restaurant_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active banners in window"
ON public.restaurant_banners FOR SELECT
USING (
  active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);

CREATE POLICY "Restaurant staff can manage banners"
ON public.restaurant_banners FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access banners"
ON public.restaurant_banners FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_restaurant_banners_updated_at
BEFORE UPDATE ON public.restaurant_banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();