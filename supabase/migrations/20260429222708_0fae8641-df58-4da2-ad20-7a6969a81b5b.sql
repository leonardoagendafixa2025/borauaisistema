
DROP VIEW IF EXISTS public.restaurants_public;

CREATE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT
  id, name, slug, logo_url, banner_url,
  phone, whatsapp, address, city, state, zip_code,
  status, is_open, force_closed,
  created_at, updated_at
FROM public.restaurants;

DROP POLICY IF EXISTS "Public storefront read" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view suspended restaurants" ON public.restaurants;

CREATE POLICY "Public storefront read safe"
  ON public.restaurants FOR SELECT
  TO anon, authenticated
  USING (status IN ('active','trial','suspended','cancelled','overdue'));

REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, slug, logo_url, banner_url,
  phone, whatsapp, address, city, state, zip_code,
  status, is_open, force_closed, created_at, updated_at
) ON public.restaurants TO anon;

GRANT SELECT ON public.restaurants TO authenticated;
GRANT SELECT ON public.restaurants_public TO anon, authenticated;
