DROP POLICY IF EXISTS "Anon can view recent orders" ON public.orders;
DROP POLICY IF EXISTS "Anon and authenticated can view recent orders" ON public.orders;
CREATE POLICY "Anon and authenticated can view recent orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));

DROP POLICY IF EXISTS "Anon can view recent order items" ON public.order_items;
DROP POLICY IF EXISTS "Anon and authenticated can view recent order items" ON public.order_items;
CREATE POLICY "Anon and authenticated can view recent order items"
ON public.order_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > (now() - interval '4 hours')
  )
);