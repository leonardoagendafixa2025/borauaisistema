-- Secure status helper for public order tracking without exposing review content
CREATE OR REPLACE FUNCTION public.get_order_rating_status(_order_id uuid)
RETURNS TABLE(restaurant_done boolean, driver_done boolean, is_delivery boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.satisfaction_surveys s
      WHERE s.order_id = o.id
    ) AS restaurant_done,
    CASE
      WHEN o.type = 'delivery'::order_type AND o.driver_id IS NOT NULL THEN EXISTS (
        SELECT 1 FROM public.driver_ratings dr
        WHERE dr.order_id = o.id
      )
      ELSE true
    END AS driver_done,
    (o.type = 'delivery'::order_type AND o.driver_id IS NOT NULL) AS is_delivery
  FROM public.orders o
  WHERE o.id = _order_id
    AND o.created_at > now() - interval '7 days'
  LIMIT 1;
$$;

-- Reinforce one review per order at database level
CREATE UNIQUE INDEX IF NOT EXISTS satisfaction_surveys_order_unique
ON public.satisfaction_surveys(order_id)
WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS driver_ratings_order_id_key
ON public.driver_ratings(order_id);

-- Create in-app notification for restaurant owner on new order
CREATE OR REPLACE FUNCTION public.notify_new_order_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  SELECT owner_id INTO _owner_id
  FROM public.restaurants
  WHERE id = NEW.restaurant_id;

  IF _owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, restaurant_id, type, title, message, link)
  VALUES (
    _owner_id,
    NEW.restaurant_id,
    'new_order',
    'Novo pedido #' || NEW.number,
    COALESCE(NEW.customer_name, 'Cliente') || ' fez um pedido de R$ ' || to_char(COALESCE(NEW.total, 0), 'FM999G999G990D00'),
    '/restaurant/orders'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_order_owner_trigger ON public.orders;
CREATE TRIGGER notify_new_order_owner_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order_owner();

-- Ensure realtime can send complete row payloads for order updates/inserts
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;