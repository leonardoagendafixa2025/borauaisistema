-- Trigger to keep restaurants.status automatically in sync when subscriptions.status is modified
CREATE OR REPLACE FUNCTION public.sync_restaurant_status_on_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.restaurants SET status = 'active' WHERE id = NEW.restaurant_id;
  ELSIF NEW.status = 'trial' THEN
    UPDATE public.restaurants SET status = 'trial' WHERE id = NEW.restaurant_id;
  ELSIF NEW.status = 'suspended' THEN
    UPDATE public.restaurants SET status = 'suspended' WHERE id = NEW.restaurant_id;
  ELSIF NEW.status IN ('cancelled', 'canceled') THEN
    UPDATE public.restaurants SET status = 'cancelled' WHERE id = NEW.restaurant_id;
  ELSIF NEW.status = 'overdue' THEN
    UPDATE public.restaurants SET status = 'overdue' WHERE id = NEW.restaurant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_restaurant_status ON public.subscriptions;
CREATE TRIGGER trg_sync_restaurant_status
AFTER INSERT OR UPDATE OF status ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_restaurant_status_on_subscription_change();
