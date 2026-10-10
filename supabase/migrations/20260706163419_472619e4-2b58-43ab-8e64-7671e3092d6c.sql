-- Restore anon read access to active/trial restaurants via restaurants_public view.
-- The view has security_invoker=on and only exposes public storefront columns
-- (no owner_id, no email, no billing fields), so this is safe.

GRANT SELECT ON public.restaurants TO anon;

CREATE POLICY "Public can view active restaurants"
ON public.restaurants
FOR SELECT
TO anon
USING (status IN ('active'::restaurant_status, 'trial'::restaurant_status));