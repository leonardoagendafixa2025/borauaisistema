
-- Fix: allow authenticated users to also create orders (for dine-in from logged-in browsers)
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
CREATE POLICY "Authenticated users can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix: allow authenticated users to also insert order items
DROP POLICY IF EXISTS "Authenticated users can insert order items" ON public.order_items;
CREATE POLICY "Authenticated users can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (true);
