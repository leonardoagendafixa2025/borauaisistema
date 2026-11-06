-- Migration: Fix delivery_drivers permissions, RLS policies, and automatic PIN generation
-- Date: 2026-10-28
-- Description:
-- 1. Restores table-level SELECT on delivery_drivers to authenticated role (fixes 42501 permission denied when querying select('*') or reading access_pin).
-- 2. Grants INSERT, UPDATE, DELETE to authenticated and ALL to service_role.
-- 3. Updates RLS policies to ensure restaurant owners, managers, and super_admins can fully manage delivery_drivers.
-- 4. Creates a BEFORE INSERT trigger on delivery_drivers to automatically assign a 6-digit access_pin via generate_driver_pin if null.
-- 5. Backfills any existing delivery_drivers with null access_pin.

-- 1. Permissões de tabela no PostgreSQL
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_drivers TO authenticated;
GRANT ALL ON public.delivery_drivers TO service_role;

-- 2. Limpar políticas antigas conflitantes
DROP POLICY IF EXISTS "Restaurant staff can manage drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Restaurant staff read drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Restaurant managers manage drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Super admins full access drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Restaurant staff and owners can view drivers" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Restaurant managers and owners can manage drivers" ON public.delivery_drivers;

-- 3. Política para leitura (SELECT): equipe do restaurante, proprietário ou super admin
CREATE POLICY "Restaurant staff and owners can view drivers"
ON public.delivery_drivers
FOR SELECT
TO authenticated
USING (
  public.has_restaurant_role(auth.uid(), restaurant_id)
  OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- 4. Política para gerenciamento completo (INSERT, UPDATE, DELETE): gerente+, proprietário ou super admin
CREATE POLICY "Restaurant managers and owners can manage drivers"
ON public.delivery_drivers
FOR ALL
TO authenticated
USING (
  public.has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- 5. Trigger para gerar PIN automaticamente no INSERT de novo entregador se não fornecido
CREATE OR REPLACE FUNCTION public.set_driver_access_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_pin IS NULL OR trim(NEW.access_pin) = '' THEN
    NEW.access_pin := public.generate_driver_pin(NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_driver_access_pin ON public.delivery_drivers;
CREATE TRIGGER trg_set_driver_access_pin
  BEFORE INSERT ON public.delivery_drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_driver_access_pin();

-- 6. Backfill de PINs para entregadores já existentes que estejam sem PIN
UPDATE public.delivery_drivers
SET access_pin = public.generate_driver_pin(restaurant_id)
WHERE access_pin IS NULL OR trim(access_pin) = '';
