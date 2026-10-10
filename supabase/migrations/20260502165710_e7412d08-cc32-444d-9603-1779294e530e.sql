CREATE OR REPLACE FUNCTION public.can_insert_recent_public_order_item(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = _order_id
      AND o.created_at > now() - interval '4 hours'
      AND r.status IN ('active', 'trial')
  );
$$;

DROP POLICY IF EXISTS "Public can insert order items for valid orders" ON public.order_items;

CREATE POLICY "Public can insert order items for recent public orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (public.can_insert_recent_public_order_item(order_id));