-- Save master-notify URL in platform_settings
INSERT INTO platform_settings (key, value)
VALUES ('master_notify_url', '"https://twdkcgludxeoezwgolhf.supabase.co/functions/v1/master-notify"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Helper function to invoke master-notify
CREATE OR REPLACE FUNCTION public.notify_master_event(_event_type text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _anon_key text;
  _master_chat text;
BEGIN
  SELECT value::text INTO _master_chat FROM platform_settings WHERE key = 'master_telegram_chat_id';
  IF _master_chat IS NULL THEN RETURN; END IF;

  SELECT value::text INTO _url FROM platform_settings WHERE key = 'master_notify_url';
  SELECT value::text INTO _anon_key FROM platform_settings WHERE key = 'telegram_notify_anon_key';
  IF _url IS NULL OR _anon_key IS NULL THEN RETURN; END IF;

  -- strip jsonb quotes
  _url := trim(both '"' from _url);
  _anon_key := trim(both '"' from _anon_key);

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object('event_type', _event_type, 'payload', _payload)
  );
END;
$$;

-- Trigger: new restaurant
CREATE OR REPLACE FUNCTION public.trg_master_new_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_active int;
BEGIN
  SELECT count(*) INTO _total_active FROM restaurants WHERE status IN ('active','trial');
  PERFORM notify_master_event(
    'new_restaurant',
    jsonb_build_object(
      'restaurant_id', NEW.id,
      'name', NEW.name,
      'slug', NEW.slug,
      'owner_email', NEW.owner_email,
      'plan', NEW.status,
      'total_active', _total_active
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS master_new_restaurant ON restaurants;
CREATE TRIGGER master_new_restaurant
AFTER INSERT ON restaurants
FOR EACH ROW
EXECUTE FUNCTION trg_master_new_restaurant();

-- Trigger: subscription cancelled
CREATE OR REPLACE FUNCTION public.trg_master_subscription_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant_name text;
  _plan_name text;
  _plan_price numeric;
  _was_active text;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    SELECT name INTO _restaurant_name FROM restaurants WHERE id = NEW.restaurant_id;
    SELECT name, price INTO _plan_name, _plan_price FROM subscription_plans WHERE id = NEW.plan_id;
    _was_active := EXTRACT(DAY FROM (now() - NEW.created_at))::text || ' dias';

    PERFORM notify_master_event(
      'subscription_cancelled',
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'restaurant_name', _restaurant_name,
        'plan', _plan_name,
        'mrr_lost', _plan_price,
        'was_active_for', _was_active
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS master_subscription_cancelled ON subscriptions;
CREATE TRIGGER master_subscription_cancelled
AFTER UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION trg_master_subscription_cancelled();