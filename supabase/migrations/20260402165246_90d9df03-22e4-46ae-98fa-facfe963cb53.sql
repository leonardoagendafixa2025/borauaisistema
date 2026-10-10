
-- Allow anon users to insert orders (public menu / dine-in flow)
CREATE POLICY "Anon can create orders"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon users to insert order items
CREATE POLICY "Anon can insert order items"
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to view their recent orders (last 4h)
CREATE POLICY "Anon can view recent orders"
ON public.orders
FOR SELECT
TO anon
USING (created_at > now() - interval '4 hours');

-- Allow anon to view order items of recent orders
CREATE POLICY "Anon can view recent order items"
ON public.order_items
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_items.order_id
  AND o.created_at > now() - interval '4 hours'
));
