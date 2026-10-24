-- Migration: Fix RLS for Restaurant Registration and Subscription Management
-- Date: 2026-10-24
-- Description:
-- 1. Fixes RLS error when registering a restaurant (allows owners to SELECT their newly created restaurant upon INSERT RETURNING *)
-- 2. Fixes RLS on user_roles so owners can assign themselves the 'owner' role on their own restaurant
-- 3. Fixes RLS on restaurant_settings so owners can insert/update settings
-- 4. Fixes RLS on subscriptions so owners can insert trial subscriptions AND update their subscriptions (switch plans, cancellation scheduling)
-- 5. Grants full access to subscriptions, plans, and payments for master roles (super_admin, commercial, finance)

-- ========================================================
-- 1. FIX RESTAURANTS RLS
-- ========================================================
-- Allow owner to SELECT their own restaurant (fixes "new row violates row-level security policy for table restaurants" on insert(...).select())
DROP POLICY IF EXISTS "Restaurant owner can view own restaurant" ON public.restaurants;
CREATE POLICY "Restaurant owner can view own restaurant"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_restaurant_role(auth.uid(), id)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'commercial'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
);

-- Ensure authenticated users can also view active & trial restaurants (for public storefront & listing)
DROP POLICY IF EXISTS "Authenticated can view active restaurants" ON public.restaurants;
CREATE POLICY "Authenticated can view active restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (status IN ('active'::restaurant_status, 'trial'::restaurant_status));

-- ========================================================
-- 2. FIX USER_ROLES RLS
-- ========================================================
-- Allow users to assign their own owner role during initial restaurant onboarding
DROP POLICY IF EXISTS "User can assign own owner role" ON public.user_roles;
CREATE POLICY "User can assign own owner role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'owner'::app_role
  AND restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid()
  )
);

-- Master admins full management of user_roles
DROP POLICY IF EXISTS "Master admins can manage roles" ON public.user_roles;
CREATE POLICY "Master admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

-- ========================================================
-- 3. FIX RESTAURANT_SETTINGS RLS
-- ========================================================
DROP POLICY IF EXISTS "Owner can insert restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Owner can insert restaurant settings"
ON public.restaurant_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.id = restaurant_settings.restaurant_id
      AND (restaurants.owner_id = auth.uid() OR public.has_restaurant_role(auth.uid(), restaurants.id))
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Owner can update own restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Owner can update own restaurant settings"
ON public.restaurant_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.id = restaurant_settings.restaurant_id
      AND (restaurants.owner_id = auth.uid() OR public.has_restaurant_role(auth.uid(), restaurants.id))
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.id = restaurant_settings.restaurant_id
      AND (restaurants.owner_id = auth.uid() OR public.has_restaurant_role(auth.uid(), restaurants.id))
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- ========================================================
-- 4. FIX SUBSCRIPTIONS RLS (Contracting & Managing Plans)
-- ========================================================
-- Allow owners and restaurant staff to view their subscriptions
DROP POLICY IF EXISTS "Restaurant owner can view own subscription" ON public.subscriptions;
CREATE POLICY "Restaurant owner can view own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = subscriptions.restaurant_id
      AND (r.owner_id = auth.uid() OR public.has_restaurant_role(auth.uid(), r.id))
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'commercial'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
);

-- Allow owner to insert trial/incomplete subscription
DROP POLICY IF EXISTS "Owner can insert own trial subscription" ON public.subscriptions;
CREATE POLICY "Owner can insert own trial subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.id = subscriptions.restaurant_id
      AND restaurants.owner_id = auth.uid()
  )
  AND (status IN ('trialing', 'trial', 'incomplete'))
);

-- Allow owner to update own subscription (e.g. switching plan, proration update, cancel_at_period_end)
DROP POLICY IF EXISTS "Owner can update own subscription" ON public.subscriptions;
CREATE POLICY "Owner can update own subscription"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.id = subscriptions.restaurant_id
      AND restaurants.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE restaurants.id = subscriptions.restaurant_id
      AND restaurants.owner_id = auth.uid()
  )
);

-- Master admins full access to subscriptions
DROP POLICY IF EXISTS "Super admins full access subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Master admins full access subscriptions" ON public.subscriptions;
CREATE POLICY "Master admins full access subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'commercial'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'commercial'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
);

-- ========================================================
-- 5. FIX SUBSCRIPTION_PAYMENTS RLS
-- ========================================================
DROP POLICY IF EXISTS "Super admins full access subscription_payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Master admins full access subscription_payments" ON public.subscription_payments;
CREATE POLICY "Master admins full access subscription_payments"
ON public.subscription_payments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'commercial'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'commercial'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
);
