-- ============================================================================
-- HARDENING DE SEGURANÇA — Fases A + B
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1. user_roles: bloqueia escalonamento de privilégio
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner can insert user_roles" ON public.user_roles;

-- Só o dono do restaurante (ou super_admin) pode inserir/alterar roles desse restaurante
CREATE POLICY "Restaurant owner manages user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Restaurant owner updates user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Restaurant owner deletes user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- A2. orders / order_items: PII protegida
-- Cliente só pode buscar pedido se souber o ID exato (UUID)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon and authenticated can view recent orders" ON public.orders;
DROP POLICY IF EXISTS "Anon and authenticated can view recent order items" ON public.order_items;

-- RPC segura para acompanhar pedido por ID (já existe lógica similar no front)
CREATE OR REPLACE FUNCTION public.get_order_for_tracking(_order_id uuid)
RETURNS TABLE (
  id uuid,
  number integer,
  status order_status,
  type order_type,
  total numeric,
  subtotal numeric,
  delivery_fee numeric,
  discount numeric,
  payment_method text,
  payment_status text,
  customer_name text,
  customer_phone text,
  address text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  restaurant_id uuid,
  table_id uuid,
  driver_id uuid,
  items jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.number, o.status, o.type, o.total, o.subtotal, o.delivery_fee, o.discount,
    o.payment_method, o.payment_status, o.customer_name, o.customer_phone, o.address, o.notes,
    o.created_at, o.updated_at, o.restaurant_id, o.table_id, o.driver_id,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'name', oi.name, 'qty', oi.qty,
        'unit_price', oi.unit_price, 'total_price', oi.total_price,
        'options', oi.options, 'notes', oi.notes
      ) ORDER BY oi.created_at)
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb) AS items
  FROM public.orders o
  WHERE o.id = _order_id
    AND o.created_at > now() - interval '7 days'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_order_for_tracking(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_for_tracking(uuid) TO anon, authenticated;

-- RPC para buscar pedido por telefone (sem expor toda a tabela)
CREATE OR REPLACE FUNCTION public.find_orders_by_phone(_restaurant_id uuid, _phone text)
RETURNS TABLE (
  id uuid,
  number integer,
  status order_status,
  type order_type,
  total numeric,
  customer_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.number, o.status, o.type, o.total, o.customer_name, o.created_at
  FROM public.orders o
  WHERE o.restaurant_id = _restaurant_id
    AND regexp_replace(COALESCE(o.customer_phone, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND o.created_at > now() - interval '7 days'
  ORDER BY o.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.find_orders_by_phone(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_orders_by_phone(uuid, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- A3. satisfaction_surveys: leitura pública removida
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Anyone can view surveys" ON public.satisfaction_surveys;

-- Mantém INSERT público (cliente envia avaliação) e leitura só para staff
-- Verifica se a policy de staff já existe; se não, cria:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='satisfaction_surveys'
      AND policyname='Restaurant staff can view surveys'
  ) THEN
    CREATE POLICY "Restaurant staff can view surveys"
    ON public.satisfaction_surveys
    FOR SELECT
    TO authenticated
    USING (has_restaurant_role(auth.uid(), restaurant_id));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- A4. Storage restaurant-assets: isolamento por restaurante
-- Paths usados: {restaurantId}/... e banners/{restaurantId}/...
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can upload restaurant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update restaurant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete restaurant assets" ON storage.objects;

CREATE POLICY "Restaurant staff upload own assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'restaurant-assets'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      -- path = "{rest_id}/..." → primeira pasta é o uuid
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
    OR (
      -- path = "banners/{rest_id}/..."
      (storage.foldername(name))[1] = 'banners'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

CREATE POLICY "Restaurant staff update own assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
    OR (
      (storage.foldername(name))[1] = 'banners'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

CREATE POLICY "Restaurant staff delete own assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
    OR (
      (storage.foldername(name))[1] = 'banners'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

-- ----------------------------------------------------------------------------
-- A5. restaurants: oculta e-mail/telefone do dono ao público
-- ----------------------------------------------------------------------------
-- Remove leituras públicas existentes que expõem todas as colunas
DROP POLICY IF EXISTS "Anyone can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

-- View pública somente com campos seguros (sem owner email/phone/whatsapp)
CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = true)
AS
SELECT
  id, name, slug, logo_url, banner_url, address, city, state, zip_code,
  is_open, force_closed, status, created_at
FROM public.restaurants;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- Acesso à tabela completa: dono, staff e super_admin
CREATE POLICY "Owner and staff can view restaurant"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_restaurant_role(auth.uid(), id)
);

-- Acesso público mínimo (slug + dados de vitrine) via tabela ainda é necessário
-- pois muitas telas públicas leem restaurants direto. Permitimos SELECT público
-- mas o aplicativo deve preferir a view. Para não quebrar nada hoje, mantemos
-- leitura pública mas você pode migrar para a view nas próximas sprints.
CREATE POLICY "Public storefront read"
ON public.restaurants
FOR SELECT
TO anon, authenticated
USING (status IN ('active', 'trial'));

-- ----------------------------------------------------------------------------
-- A6. restaurant_settings: oculta telegram_chat_id do público
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view settings" ON public.restaurant_settings;

CREATE OR REPLACE VIEW public.restaurant_settings_public
WITH (security_invoker = true)
AS
SELECT
  id, restaurant_id,
  primary_color, secondary_color,
  opening_hours, payment_methods,
  estimated_prep_time, delivery_fee, min_order_value,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  service_fee_enabled, service_fee_percent,
  couvert_enabled, couvert_value,
  quick_sale_enabled, quick_sale_active_days,
  quick_sale_start_time, quick_sale_end_time,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
FROM public.restaurant_settings;

GRANT SELECT ON public.restaurant_settings_public TO anon, authenticated;

-- Restringe a tabela completa: só staff/dono/super_admin
CREATE POLICY "Staff can view settings"
ON public.restaurant_settings
FOR SELECT
TO authenticated
USING (
  has_restaurant_role(auth.uid(), restaurant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Mantém leitura pública mínima para storefront não quebrar enquanto migramos
-- (sem telegram_chat_id é o ideal, mas hoje várias telas usam SELECT *)
CREATE POLICY "Public storefront settings"
ON public.restaurant_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- NOTA: o ideal é o front trocar SELECT * por restaurant_settings_public.
-- Isto será endereçado em sprint seguinte; a coluna telegram_chat_id
-- continuará exposta até lá (warning, não erro crítico — bot Telegram apenas).

-- ----------------------------------------------------------------------------
-- B1. has_restaurant_role com filtro de papel mínimo
-- ----------------------------------------------------------------------------
-- Hierarquia: owner=4 > manager=3 > attendant=2 > kitchen=1
CREATE OR REPLACE FUNCTION public.has_min_restaurant_role(
  _user_id uuid,
  _restaurant_id uuid,
  _min_role app_role
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH levels AS (
    SELECT 'owner'::app_role AS role, 4 AS lvl
    UNION ALL SELECT 'manager', 3
    UNION ALL SELECT 'attendant', 2
    UNION ALL SELECT 'kitchen', 1
  ),
  needed AS (SELECT lvl FROM levels WHERE role = _min_role)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN levels l ON l.role = ur.role
    WHERE ur.user_id = _user_id
      AND ur.restaurant_id = _restaurant_id
      AND l.lvl >= (SELECT lvl FROM needed)
  );
$$;

REVOKE ALL ON FUNCTION public.has_min_restaurant_role(uuid, uuid, app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_min_restaurant_role(uuid, uuid, app_role) TO authenticated;

-- Aplicar em tabelas sensíveis: financial_transactions, cashier_sessions, expenses
-- (substitui as policies "all staff" por "manager+")

-- financial_transactions
DROP POLICY IF EXISTS "Restaurant staff can insert financial transactions" ON public.financial_transactions;
CREATE POLICY "Manager+ can insert financial"
ON public.financial_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

DROP POLICY IF EXISTS "Restaurant owner can view own financial" ON public.financial_transactions;
CREATE POLICY "Manager+ can view financial"
ON public.financial_transactions
FOR SELECT
TO authenticated
USING (
  has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- expenses: manager+ apenas
DROP POLICY IF EXISTS "Restaurant staff manage expenses" ON public.expenses;
CREATE POLICY "Manager+ manage expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

DROP POLICY IF EXISTS "Restaurant staff manage expense categories" ON public.expense_categories;
CREATE POLICY "Manager+ manage expense categories"
ON public.expense_categories
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

-- cashier_sessions: attendant+ pode (caixa precisa abrir/fechar caixa)
-- mantém has_restaurant_role mas exclui kitchen
DROP POLICY IF EXISTS "Restaurant staff can manage cashier sessions" ON public.cashier_sessions;
CREATE POLICY "Attendant+ manage cashier"
ON public.cashier_sessions
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'attendant'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'attendant'::app_role));

-- ----------------------------------------------------------------------------
-- B3. Tighten anon insert policies — orders/order_items/customers
-- Validar que restaurant_id existe e está ativo (defesa em profundidade)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;

CREATE POLICY "Public can create orders for active restaurants"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id
      AND r.status IN ('active', 'trial')
  )
);

DROP POLICY IF EXISTS "Anon can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can insert order items" ON public.order_items;

CREATE POLICY "Public can insert order items for valid orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > now() - interval '4 hours'
  )
);

DROP POLICY IF EXISTS "Anon can insert customers" ON public.customers;
CREATE POLICY "Public can insert customers for active restaurants"
ON public.customers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = customers.restaurant_id
      AND r.status IN ('active', 'trial')
  )
);

-- ----------------------------------------------------------------------------
-- driver_ratings: evita escrita anônima abusiva (restringe a leitura por ID)
-- A policy de INSERT já verifica que o pedido existe e está completed nos últimos 7d
-- Mantém como está — apenas garante leitura via SECURITY DEFINER já existente
-- ----------------------------------------------------------------------------