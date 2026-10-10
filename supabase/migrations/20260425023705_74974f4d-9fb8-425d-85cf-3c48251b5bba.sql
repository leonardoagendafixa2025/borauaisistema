-- 1. Adiciona PIN de 6 dígitos para login do entregador no app PWA
ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS access_pin text,
  ADD COLUMN IF NOT EXISTS last_lat double precision,
  ADD COLUMN IF NOT EXISTS last_lng double precision,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

-- Índice para login rápido por PIN dentro do restaurante
CREATE UNIQUE INDEX IF NOT EXISTS delivery_drivers_pin_unique
  ON public.delivery_drivers (restaurant_id, access_pin)
  WHERE access_pin IS NOT NULL;

-- Função pra gerar PIN único de 6 dígitos no restaurante
CREATE OR REPLACE FUNCTION public.generate_driver_pin(_restaurant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pin text;
  _exists boolean;
  _attempts int := 0;
BEGIN
  LOOP
    _pin := lpad(floor(random() * 1000000)::text, 6, '0');
    SELECT EXISTS(
      SELECT 1 FROM delivery_drivers
      WHERE restaurant_id = _restaurant_id AND access_pin = _pin
    ) INTO _exists;
    EXIT WHEN NOT _exists OR _attempts > 50;
    _attempts := _attempts + 1;
  END LOOP;
  RETURN _pin;
END;
$$;

-- Backfill PIN para entregadores existentes
UPDATE public.delivery_drivers
SET access_pin = public.generate_driver_pin(restaurant_id)
WHERE access_pin IS NULL;

-- 2. Timestamps de despacho e entrega para cronômetro/SLA
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Trigger para preencher dispatched_at quando status vira 'delivering'
CREATE OR REPLACE FUNCTION public.set_order_dispatched_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivering' AND (OLD.status IS DISTINCT FROM 'delivering') AND NEW.dispatched_at IS NULL THEN
    NEW.dispatched_at := now();
  END IF;
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_dispatched ON public.orders;
CREATE TRIGGER trg_set_order_dispatched
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_dispatched_at();

-- 3. RPC pública para login do entregador por PIN (sem auth)
CREATE OR REPLACE FUNCTION public.driver_login(_restaurant_slug text, _pin text)
RETURNS TABLE (driver_id uuid, driver_name text, restaurant_id uuid, restaurant_name text, vehicle text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.name, d.restaurant_id, r.name, d.vehicle
  FROM delivery_drivers d
  JOIN restaurants r ON r.id = d.restaurant_id
  WHERE r.slug = _restaurant_slug
    AND d.access_pin = _pin
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_login(text, text) TO anon, authenticated;

-- 4. RPC pública para o entregador atualizar a própria localização e status (sem auth, validado por PIN+id)
CREATE OR REPLACE FUNCTION public.driver_heartbeat(
  _driver_id uuid,
  _pin text,
  _lat double precision,
  _lng double precision,
  _status text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM delivery_drivers
    WHERE id = _driver_id AND access_pin = _pin
  ) INTO _ok;
  IF NOT _ok THEN
    RETURN false;
  END IF;

  UPDATE delivery_drivers
  SET last_lat = _lat,
      last_lng = _lng,
      last_location_at = now(),
      status = COALESCE(_status, status),
      updated_at = now()
  WHERE id = _driver_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_heartbeat(uuid, text, double precision, double precision, text) TO anon, authenticated;

-- 5. RPC pra entregador marcar pedido como entregue
CREATE OR REPLACE FUNCTION public.driver_mark_delivered(
  _driver_id uuid,
  _pin text,
  _order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM delivery_drivers d
    JOIN orders o ON o.driver_id = d.id
    WHERE d.id = _driver_id AND d.access_pin = _pin AND o.id = _order_id
  ) INTO _ok;
  IF NOT _ok THEN RETURN false; END IF;

  UPDATE orders SET status = 'completed', delivered_at = now(), updated_at = now()
  WHERE id = _order_id;

  -- Libera entregador se não houver mais entregas em andamento
  UPDATE delivery_drivers SET status = 'available'
  WHERE id = _driver_id
    AND NOT EXISTS (
      SELECT 1 FROM orders WHERE driver_id = _driver_id AND status = 'delivering'
    );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_mark_delivered(uuid, text, uuid) TO anon, authenticated;

-- 6. RLS: permite entregador (anon) ler apenas seus próprios pedidos via select com filtro driver_id (controle no client + RPC)
-- Como o app do entregador não usa auth, a leitura dos pedidos atribuídos vai por RPC dedicada:
CREATE OR REPLACE FUNCTION public.driver_list_assigned_orders(_driver_id uuid, _pin text)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery_drivers WHERE id = _driver_id AND access_pin = _pin) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT * FROM orders
    WHERE driver_id = _driver_id
      AND status IN ('delivering', 'ready')
    ORDER BY dispatched_at NULLS LAST, created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_list_assigned_orders(uuid, text) TO anon, authenticated;

-- Habilita realtime para drivers (mapa em tempo real no painel)
ALTER TABLE public.delivery_drivers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;