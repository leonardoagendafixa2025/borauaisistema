CREATE OR REPLACE FUNCTION public.restaurant_has_reservations(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.restaurant_id = _restaurant_id
      AND s.status IN ('active','trial','trialing','past_due')
      AND p.tier IN ('professional','premium')
  );
$$;

GRANT EXECUTE ON FUNCTION public.restaurant_has_reservations(uuid) TO anon, authenticated;