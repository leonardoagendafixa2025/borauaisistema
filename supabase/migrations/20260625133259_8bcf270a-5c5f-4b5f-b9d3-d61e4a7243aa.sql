
-- ============================================================
-- 1. Helper: SECURITY DEFINER check for active restaurant (for anon RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_restaurant_orderable(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _id AND status IN ('active'::restaurant_status, 'trial'::restaurant_status)
  );
$$;

-- ============================================================
-- 2. restaurants: drop dead public storefront policy (anon has no table grant; safe to remove)
-- ============================================================
DROP POLICY IF EXISTS "Public storefront read safe" ON public.restaurants;

-- ============================================================
-- 3. music_requests: restrict anon column access + tighten policy
-- ============================================================
REVOKE SELECT ON public.music_requests FROM anon;
GRANT SELECT (id, restaurant_id, song_text, status, created_at, played_at, table_label, price, payment_status, dedication) ON public.music_requests TO anon;

DROP POLICY IF EXISTS "Public can view recent music queue" ON public.music_requests;
CREATE POLICY "Public can view recent music queue" ON public.music_requests
  FOR SELECT TO anon, authenticated
  USING (
    created_at > now() - interval '6 hours'
    AND status IN ('queued', 'playing', 'pending_approval')
  );

-- ============================================================
-- 4. platform_settings: lock down to super_admin only
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read platform_settings" ON public.platform_settings;
REVOKE SELECT ON public.platform_settings FROM anon;

-- ============================================================
-- 5. referral_codes: anon can only see code + active
-- ============================================================
REVOKE SELECT ON public.referral_codes FROM anon;
GRANT SELECT (id, code, active, restaurant_id) ON public.referral_codes TO anon;

-- ============================================================
-- 6. restaurant_settings: anon limited to display-safe columns
-- ============================================================
REVOKE SELECT ON public.restaurant_settings FROM anon;
GRANT SELECT (
  id, restaurant_id,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  min_order_value, estimated_prep_time, delivery_fee,
  payment_methods, opening_hours,
  primary_color, secondary_color,
  couvert_enabled, couvert_value,
  service_fee_enabled, service_fee_percent,
  music_requests_enabled, music_requests_price,
  music_requests_window_start, music_requests_window_end, music_requests_require_approval,
  quick_sale_enabled, quick_sale_auto_schedule,
  quick_sale_start_time, quick_sale_end_time, quick_sale_active_days,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
) ON public.restaurant_settings TO anon;

-- ============================================================
-- 7. Replace always-true INSERT/UPDATE policies
-- ============================================================
DROP POLICY IF EXISTS "Anon can create waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon can create waiter calls" ON public.waiter_calls
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can insert table sessions" ON public.table_sessions;
CREATE POLICY "Anon can insert table sessions" ON public.table_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can update table sessions" ON public.table_sessions;
CREATE POLICY "Anon can update table sessions" ON public.table_sessions
  FOR UPDATE TO anon, authenticated
  USING (last_seen_at > now() - interval '4 hours' AND public.is_restaurant_orderable(restaurant_id))
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can insert commands" ON public.table_commands;
CREATE POLICY "Anon can insert commands" ON public.table_commands
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can create reservations" ON public.table_reservations;
CREATE POLICY "Anon can create reservations" ON public.table_reservations
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can submit surveys" ON public.satisfaction_surveys;
CREATE POLICY "Anon can submit surveys" ON public.satisfaction_surveys
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

-- ============================================================
-- 8. SECURITY DEFINER functions: revoke broad EXECUTE, re-grant intended RPCs
-- ============================================================
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      rec.proname, rec.args
    );
  END LOOP;
END $$;

-- RLS helpers (must be callable by anon/authenticated for policy evaluation)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_restaurant_role(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_min_restaurant_role(uuid, uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_insert_recent_public_order_item(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_restaurant_orderable(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_drink_category_name(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unaccent_simple(text) TO anon, authenticated;

-- Public RPCs: customer-facing tracking & driver app (auth via parameter PIN / order id)
GRANT EXECUTE ON FUNCTION public.driver_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_heartbeat(uuid, text, double precision, double precision, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_mark_delivered(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_confirm_receipt(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_list_assigned_orders(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_list_history(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_earnings_summary(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_orders_by_phone(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_for_tracking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_rating_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_driver_location(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_open_orders(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_commands_for_table(uuid, text) TO anon, authenticated;

-- Staff-only RPCs
GRANT EXECUTE ON FUNCTION public.approve_music_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_music_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_driver_pin(uuid) TO authenticated;

-- Trigger functions and internal helpers (notify_*, trg_*, handle_new_user, update_updated_at_column, set_*, deduct_stock_on_order, auto_skip_kitchen_for_drinks, update_wristband_totals)
-- remain with EXECUTE revoked from anon/authenticated/PUBLIC; service_role and triggers still work.

-- ============================================================
-- 9. Storage bucket: drop broad anon list policy
-- ============================================================
DROP POLICY IF EXISTS "Public can view restaurant assets" ON storage.objects;
