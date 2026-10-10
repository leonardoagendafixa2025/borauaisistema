
-- 1) user_roles
DROP POLICY IF EXISTS "Restaurant owner manages user_roles" ON public.user_roles;
CREATE POLICY "Restaurant owner manages user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    role <> 'super_admin'::app_role
    AND restaurant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Restaurant owner updates user_roles" ON public.user_roles;
CREATE POLICY "Restaurant owner updates user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    role <> 'super_admin'::app_role
    AND restaurant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid())
  )
);

-- 2) music_requests
DROP POLICY IF EXISTS "Public can submit music requests when enabled" ON public.music_requests;
CREATE POLICY "Public can submit music requests when enabled"
ON public.music_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_restaurant_orderable(restaurant_id)
  AND EXISTS (
    SELECT 1 FROM public.restaurant_settings rs
    WHERE rs.restaurant_id = music_requests.restaurant_id
      AND rs.music_requests_enabled = true
      AND (
        rs.music_requests_window_start IS NULL
        OR rs.music_requests_window_end IS NULL
        OR CASE
             WHEN rs.music_requests_window_start <= rs.music_requests_window_end THEN
               ((now() AT TIME ZONE 'America/Sao_Paulo')::time >= rs.music_requests_window_start)
               AND ((now() AT TIME ZONE 'America/Sao_Paulo')::time <= rs.music_requests_window_end)
             ELSE
               ((now() AT TIME ZONE 'America/Sao_Paulo')::time >= rs.music_requests_window_start)
               OR ((now() AT TIME ZONE 'America/Sao_Paulo')::time <= rs.music_requests_window_end)
           END
      )
  )
);

-- 3) delivery_drivers: PIN apenas para gerente+
REVOKE SELECT ON public.delivery_drivers FROM authenticated;
GRANT SELECT (id, restaurant_id, name, phone, vehicle, status, last_lat, last_lng, last_location_at, created_at, updated_at)
  ON public.delivery_drivers TO authenticated;

DROP POLICY IF EXISTS "Restaurant staff can manage drivers" ON public.delivery_drivers;
CREATE POLICY "Restaurant staff read drivers"
ON public.delivery_drivers
FOR SELECT
TO authenticated
USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant managers manage drivers"
ON public.delivery_drivers
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

-- 4) restaurant_settings
DROP POLICY IF EXISTS "Public storefront settings" ON public.restaurant_settings;
CREATE POLICY "Public storefront settings"
ON public.restaurant_settings
FOR SELECT
TO anon, authenticated
USING (public.is_restaurant_orderable(restaurant_id));

REVOKE SELECT ON public.restaurant_settings FROM anon;
GRANT SELECT (
  id,
  restaurant_id,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  min_order_value, estimated_prep_time, delivery_fee,
  payment_methods, opening_hours, primary_color, secondary_color,
  couvert_enabled, couvert_value,
  service_fee_enabled, service_fee_percent,
  music_requests_enabled, music_requests_price,
  music_requests_window_start, music_requests_window_end, music_requests_require_approval,
  quick_sale_enabled, quick_sale_auto_schedule,
  quick_sale_start_time, quick_sale_end_time, quick_sale_active_days,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
) ON public.restaurant_settings TO anon;
