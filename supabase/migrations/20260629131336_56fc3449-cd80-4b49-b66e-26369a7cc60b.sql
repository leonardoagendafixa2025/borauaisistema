CREATE OR REPLACE FUNCTION public.trg_master_new_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      'owner_email', NEW.email,
      'plan', NEW.status,
      'total_active', _total_active
    )
  );
  RETURN NEW;
END;
$function$;