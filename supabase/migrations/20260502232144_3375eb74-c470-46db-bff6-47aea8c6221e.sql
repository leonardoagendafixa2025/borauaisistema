CREATE POLICY "Restaurant staff can view subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.has_restaurant_role(auth.uid(), restaurant_id));