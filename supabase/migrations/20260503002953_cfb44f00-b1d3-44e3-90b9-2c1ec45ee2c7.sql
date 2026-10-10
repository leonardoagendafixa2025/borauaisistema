-- 1) Helper unaccent (sem extensão)
CREATE OR REPLACE FUNCTION public.unaccent_simple(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    coalesce(_t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )
$$;

-- 2) Detector de bebida
CREATE OR REPLACE FUNCTION public.is_drink_category_name(_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(public.unaccent_simple(_name)) ~ '(bebid|drink|cervej|destilad|vinho|refriger|suco|agua|coquetel|dose|chopp|whisky|vodka|gin|cachac|tequila|licor|aperitivo)'
$$;

-- 3) Trigger auto-skip
CREATE OR REPLACE FUNCTION public.auto_skip_kitchen_for_drinks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_drink_category_name(NEW.name) THEN
    NEW.skip_kitchen := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_skip_kitchen_for_drinks ON public.categories;
CREATE TRIGGER trg_auto_skip_kitchen_for_drinks
BEFORE INSERT OR UPDATE OF name ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.auto_skip_kitchen_for_drinks();

-- 4) Aplicar nas existentes
UPDATE public.categories
SET skip_kitchen = true, updated_at = now()
WHERE skip_kitchen = false
  AND public.is_drink_category_name(name);