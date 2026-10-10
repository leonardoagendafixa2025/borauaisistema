
-- Fix audit_logs: require authenticated users to insert
DROP POLICY "Anyone can insert logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Fix order_items: tie insert to the order's existence
DROP POLICY "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Authenticated users can insert order items" ON public.order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Fix orders: require authentication to create orders
DROP POLICY "Anyone can create orders" ON public.orders;
CREATE POLICY "Authenticated users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
