
-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Generic dispatcher: calls the telegram-notify edge function with an event payload
CREATE OR REPLACE FUNCTION public.notify_telegram_event(
  _restaurant_id uuid,
  _event_type text,
  _payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _anon_key text;
BEGIN
  -- Read function URL + anon key from platform_settings (configurable, no hardcoded secrets in code)
  SELECT value INTO _url FROM platform_settings WHERE key = 'telegram_notify_url';
  SELECT value INTO _anon_key FROM platform_settings WHERE key = 'telegram_notify_anon_key';

  IF _url IS NULL OR _anon_key IS NULL THEN
    RETURN; -- not configured yet
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

-- ===== Trigger: New order =====
CREATE OR REPLACE FUNCTION public.trg_telegram_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_telegram_event(
    NEW.restaurant_id,
    'new_order',
    jsonb_build_object(
      'order_id', NEW.id,
      'number', NEW.number,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'type', NEW.type,
      'total', NEW.total,
      'address', NEW.address,
      'payment_method', NEW.payment_method
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_new_order_trigger ON orders;
CREATE TRIGGER telegram_new_order_trigger
AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION trg_telegram_new_order();

-- ===== Trigger: Waiter call =====
CREATE OR REPLACE FUNCTION public.trg_telegram_waiter_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _table_label text;
  _table_number int;
BEGIN
  SELECT label, number INTO _table_label, _table_number
  FROM restaurant_tables WHERE id = NEW.table_id;

  PERFORM notify_telegram_event(
    NEW.restaurant_id,
    'waiter_call',
    jsonb_build_object(
      'call_id', NEW.id,
      'type', NEW.type,
      'table_label', COALESCE(_table_label, 'Mesa ' || _table_number),
      'table_number', _table_number
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_waiter_call_trigger ON waiter_calls;
CREATE TRIGGER telegram_waiter_call_trigger
AFTER INSERT ON waiter_calls
FOR EACH ROW EXECUTE FUNCTION trg_telegram_waiter_call();

-- ===== Trigger: Bad review (NPS detractor, score <= 6) =====
CREATE OR REPLACE FUNCTION public.trg_telegram_bad_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.score <= 6 THEN
    PERFORM notify_telegram_event(
      NEW.restaurant_id,
      'bad_review',
      jsonb_build_object(
        'survey_id', NEW.id,
        'score', NEW.score,
        'customer_name', NEW.customer_name,
        'comment', NEW.comment,
        'food_rating', NEW.food_rating,
        'service_rating', NEW.service_rating,
        'delivery_rating', NEW.delivery_rating
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_bad_review_trigger ON satisfaction_surveys;
CREATE TRIGGER telegram_bad_review_trigger
AFTER INSERT ON satisfaction_surveys
FOR EACH ROW EXECUTE FUNCTION trg_telegram_bad_review();
