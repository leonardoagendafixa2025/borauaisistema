DROP POLICY IF EXISTS "Anon can view recent waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon and authenticated can view recent waiter calls"
ON public.waiter_calls
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));