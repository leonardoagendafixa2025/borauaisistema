
-- Allow authenticated users to insert their own restaurant (self-service onboarding)
CREATE POLICY "Authenticated can create own restaurant"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Allow authenticated users to insert settings for restaurants they own
CREATE POLICY "Owner can insert restaurant settings"
ON public.restaurant_settings
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.restaurants
  WHERE restaurants.id = restaurant_settings.restaurant_id
  AND restaurants.owner_id = auth.uid()
));

-- Allow authenticated users to insert subscription for restaurants they own
CREATE POLICY "Owner can insert own subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.restaurants
  WHERE restaurants.id = subscriptions.restaurant_id
  AND restaurants.owner_id = auth.uid()
));

-- Allow authenticated users to assign themselves the owner role
CREATE POLICY "User can assign own owner role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'owner');
