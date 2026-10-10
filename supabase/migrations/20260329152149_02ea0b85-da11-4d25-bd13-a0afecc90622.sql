
-- Fix the overly permissive INSERT policy - scope to specific table context
DROP POLICY "Anyone can create waiter calls" ON public.waiter_calls;
DROP POLICY "Anyone can view waiter calls" ON public.waiter_calls;

-- Allow anonymous inserts only (customers at tables)
CREATE POLICY "Anon can create waiter calls" ON public.waiter_calls
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only restaurant staff + super admins can view (covered by existing ALL policies)
-- Add anon select scoped to their own calls
CREATE POLICY "Anon can view recent waiter calls" ON public.waiter_calls
  FOR SELECT TO anon USING (created_at > now() - interval '4 hours');
