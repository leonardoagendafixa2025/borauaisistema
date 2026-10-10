-- Allow anon and authenticated to insert customers (auto-create from public orders)
CREATE POLICY "Anon can insert customers"
ON public.customers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow restaurant staff to update customers
CREATE POLICY "Restaurant staff can update customers"
ON public.customers
FOR UPDATE
USING (has_restaurant_role(auth.uid(), restaurant_id));

-- Allow restaurant staff to delete customers
CREATE POLICY "Restaurant staff can delete customers"
ON public.customers
FOR DELETE
USING (has_restaurant_role(auth.uid(), restaurant_id));