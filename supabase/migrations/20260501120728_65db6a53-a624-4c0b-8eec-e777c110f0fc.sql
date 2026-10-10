-- 1) Add column to settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS music_requests_require_approval boolean NOT NULL DEFAULT false;

-- 2) Trigger to enforce status on insert based on settings
CREATE OR REPLACE FUNCTION public.set_music_request_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needs_approval boolean;
BEGIN
  SELECT COALESCE(music_requests_require_approval, false)
    INTO needs_approval
  FROM public.restaurant_settings
  WHERE restaurant_id = NEW.restaurant_id;

  -- Only normalize when caller submitted as 'queued' (default public path)
  IF NEW.status = 'queued' AND needs_approval THEN
    NEW.status := 'pending_approval';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_music_request_initial_status ON public.music_requests;
CREATE TRIGGER trg_set_music_request_initial_status
  BEFORE INSERT ON public.music_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_music_request_initial_status();

-- 3) Allow public to view their own pending_approval requests via existing policy
-- (already allowed via 'Public can view recent music queue' time-window policy)
