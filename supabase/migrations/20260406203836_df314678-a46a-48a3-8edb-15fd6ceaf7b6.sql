CREATE POLICY "Public can view suspended restaurants"
ON public.restaurants
FOR SELECT
USING (status IN ('suspended', 'cancelled', 'overdue'));