
-- Trigger function to notify restaurant owner on new waiter call
CREATE OR REPLACE FUNCTION public.notify_waiter_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _table_label text;
  _table_number int;
  _msg text;
BEGIN
  -- Get restaurant owner
  SELECT owner_id INTO _owner_id FROM restaurants WHERE id = NEW.restaurant_id;
  IF _owner_id IS NULL THEN RETURN NEW; END IF;

  -- Get table info
  SELECT label, number INTO _table_label, _table_number FROM restaurant_tables WHERE id = NEW.table_id;

  IF NEW.type = 'request_bill' THEN
    _msg := '💰 Pedido de conta - ' || COALESCE(_table_label, 'Mesa ' || _table_number);
  ELSE
    _msg := '🔔 Chamada de garçom - ' || COALESCE(_table_label, 'Mesa ' || _table_number);
  END IF;

  INSERT INTO notifications (user_id, restaurant_id, type, title, message, link)
  VALUES (_owner_id, NEW.restaurant_id, 'waiter_call', _msg, 
          COALESCE(_table_label, 'Mesa ' || _table_number) || ' precisa de atendimento',
          '/restaurant/waiter-calls');

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_waiter_call_created
  AFTER INSERT ON public.waiter_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waiter_call();
