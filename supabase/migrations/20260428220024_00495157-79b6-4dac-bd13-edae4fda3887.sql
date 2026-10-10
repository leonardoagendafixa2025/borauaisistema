-- Revoga acesso anônimo às colunas sensíveis do dono na tabela restaurants
-- (mantém SELECT em colunas públicas)
REVOKE SELECT ON public.restaurants FROM anon;

GRANT SELECT (
  id, name, slug, logo_url, banner_url, address, city, state, zip_code,
  is_open, force_closed, status, created_at, owner_id
) ON public.restaurants TO anon;

-- Authenticated mantém acesso completo (filtrado por RLS)
-- Garantimos que authenticated também só veja colunas públicas se não for staff/dono
-- mas isso já é tratado pela RLS "Owner and staff can view restaurant" + "Public storefront read"
-- Simplificamos: authenticated vê via RLS (que limita por owner/staff/super_admin),
-- mas o public storefront read deixa anon ver. Fazer column grants a anon resolve.

-- Mesmo tratamento para restaurant_settings: revoga colunas sensíveis de anon
REVOKE SELECT ON public.restaurant_settings FROM anon;

GRANT SELECT (
  id, restaurant_id, primary_color, secondary_color, opening_hours, payment_methods,
  estimated_prep_time, delivery_fee, min_order_value,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  service_fee_enabled, service_fee_percent,
  couvert_enabled, couvert_value,
  quick_sale_enabled, quick_sale_active_days,
  quick_sale_start_time, quick_sale_end_time,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
) ON public.restaurant_settings TO anon;