CREATE POLICY "Restaurant staff can insert financial transactions"
ON public.financial_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));