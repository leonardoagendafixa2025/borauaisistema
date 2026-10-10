
-- 1) orders: use helper instead of inline join to restaurants
DROP POLICY IF EXISTS "Public can create orders for active restaurants" ON public.orders;
CREATE POLICY "Public can create orders for active restaurants"
  ON public.orders FOR INSERT
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

-- 2) customers: same
DROP POLICY IF EXISTS "Public can insert customers for active restaurants" ON public.customers;
CREATE POLICY "Public can insert customers for active restaurants"
  ON public.customers FOR INSERT
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

-- 3) audit_logs: bind user_id to auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 4) notifications: bind user_id to auth.uid() for inserts (triggers run SECURITY DEFINER/service_role and bypass RLS)
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5) coupons: scope public SELECT to active/trial restaurants and require restaurant_id filter
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
CREATE POLICY "Public can view active coupons of orderable restaurants"
  ON public.coupons FOR SELECT
  USING (active = true AND public.is_restaurant_orderable(restaurant_id));

-- 6) referral_codes: drop broad public SELECT, expose validation via RPC instead
DROP POLICY IF EXISTS "public can validate referral code" ON public.referral_codes;

CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS TABLE(id uuid, code text, restaurant_id uuid, active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.id, rc.code, rc.restaurant_id, rc.active
  FROM public.referral_codes rc
  WHERE rc.active = true
    AND rc.code = _code
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

-- 7) table_commands: scope public SELECT to orderable restaurants and recent rows only
DROP POLICY IF EXISTS "Anon can view recent commands" ON public.table_commands;
CREATE POLICY "Anon can view recent commands of orderable restaurants"
  ON public.table_commands FOR SELECT
  USING (
    opened_at > (now() - interval '4 hours')
    AND public.is_restaurant_orderable(restaurant_id)
  );

-- 8) table_sessions: same
DROP POLICY IF EXISTS "Anyone can view recent table sessions" ON public.table_sessions;
CREATE POLICY "Anon can view recent table sessions of orderable restaurants"
  ON public.table_sessions FOR SELECT
  USING (
    last_seen_at > (now() - interval '4 hours')
    AND public.is_restaurant_orderable(restaurant_id)
  );

-- 9) waiter_calls: same
DROP POLICY IF EXISTS "Anon and authenticated can view recent waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon can view recent waiter calls of orderable restaurants"
  ON public.waiter_calls FOR SELECT
  USING (
    created_at > (now() - interval '4 hours')
    AND public.is_restaurant_orderable(restaurant_id)
  );
