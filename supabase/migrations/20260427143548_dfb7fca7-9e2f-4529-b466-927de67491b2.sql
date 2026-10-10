ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.driver_confirm_receipt(_driver_id uuid, _pin text, _order_id uuid)
RETURNS TABLE(success boolean, already boolean, accepted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
  _existing timestamptz;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM delivery_drivers d
    JOIN orders o ON o.driver_id = d.id
    WHERE d.id = _driver_id AND d.access_pin = _pin AND o.id = _order_id
  ) INTO _ok;

  IF NOT _ok THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT driver_accepted_at INTO _existing FROM orders WHERE id = _order_id;

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT true, true, _existing;
    RETURN;
  END IF;

  UPDATE orders SET driver_accepted_at = now(), updated_at = now()
  WHERE id = _order_id AND driver_accepted_at IS NULL;

  SELECT driver_accepted_at INTO _existing FROM orders WHERE id = _order_id;
  RETURN QUERY SELECT true, false, _existing;
END;
$$;