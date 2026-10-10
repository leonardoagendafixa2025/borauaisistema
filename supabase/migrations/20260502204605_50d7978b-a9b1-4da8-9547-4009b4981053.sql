-- =========================================
-- 1. Tabela push_subscriptions
-- =========================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_restaurant ON public.push_subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions select"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own push subscriptions insert"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own push subscriptions update"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own push subscriptions delete"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================================
-- 2. Função notify_push_event (similar ao notify_telegram_event)
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_push_event(
  _restaurant_id UUID,
  _event_type TEXT,
  _payload JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _url TEXT;
  _anon_key TEXT;
BEGIN
  SELECT value INTO _url FROM platform_settings WHERE key = 'send_push_url';
  SELECT value INTO _anon_key FROM platform_settings WHERE key = 'send_push_anon_key';

  IF _url IS NULL OR _anon_key IS NULL THEN
    RETURN; -- not configured yet
  END IF;

  -- only fire if there is at least one subscription for this restaurant
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE restaurant_id = _restaurant_id) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'restaurant_id', _restaurant_id,
      'event_type', _event_type,
      'payload', _payload
    )
  );
END;
$$;

-- =========================================
-- 3. Triggers para os 3 eventos
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_push_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM notify_push_event(
    NEW.restaurant_id,
    'new_order',
    jsonb_build_object(
      'order_id', NEW.id,
      'number', NEW.number,
      'customer_name', NEW.customer_name,
      'type', NEW.type,
      'total', NEW.total
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_new_order ON public.orders;
CREATE TRIGGER push_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_new_order();

CREATE OR REPLACE FUNCTION public.trg_push_waiter_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _table_label TEXT;
  _table_number INT;
BEGIN
  SELECT label, number INTO _table_label, _table_number
  FROM restaurant_tables WHERE id = NEW.table_id;

  PERFORM notify_push_event(
    NEW.restaurant_id,
    'waiter_call',
    jsonb_build_object(
      'call_id', NEW.id,
      'type', NEW.type,
      'table_label', COALESCE(_table_label, 'Mesa ' || _table_number),
      'table_number', _table_number,
      'message', NEW.message
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_waiter_call ON public.waiter_calls;
CREATE TRIGGER push_waiter_call
  AFTER INSERT ON public.waiter_calls
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_waiter_call();

CREATE OR REPLACE FUNCTION public.trg_push_music_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when needs approval (status = pending_approval after the existing trigger)
  IF NEW.status = 'pending_approval' THEN
    PERFORM notify_push_event(
      NEW.restaurant_id,
      'music_request',
      jsonb_build_object(
        'request_id', NEW.id,
        'song', NEW.song_text,
        'customer_name', NEW.customer_name,
        'table_label', NEW.table_label,
        'price', NEW.price
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_music_pending ON public.music_requests;
CREATE TRIGGER push_music_pending
  AFTER INSERT ON public.music_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_music_pending();