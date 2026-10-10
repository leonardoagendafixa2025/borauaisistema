-- Trigger function to notify customer when their music request is approved or rejected
CREATE OR REPLACE FUNCTION public.trg_telegram_music_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('queued', 'rejected')
     AND OLD.status = 'pending_approval'
     AND NEW.customer_phone IS NOT NULL
     AND length(regexp_replace(NEW.customer_phone, '\D', '', 'g')) >= 8
  THEN
    PERFORM notify_telegram_event(
      NEW.restaurant_id,
      'music_status_customer',
      jsonb_build_object(
        'request_id', NEW.id,
        'song', NEW.song_text,
        'dedication', NEW.dedication,
        'customer_phone', NEW.customer_phone,
        'customer_name', NEW.customer_name,
        'status', NEW.status,
        'rejected_reason', NEW.rejected_reason,
        'price', NEW.price
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS telegram_music_status_change ON public.music_requests;
CREATE TRIGGER telegram_music_status_change
AFTER UPDATE OF status ON public.music_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_telegram_music_status_change();