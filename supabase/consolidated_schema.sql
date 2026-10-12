-- ==========================================================================
-- BORAUAI SAAS - FULL CONSOLIDATED DATABASE SCHEMA
-- Generated from 107 Lovable migrations in chronological order
-- ==========================================================================


CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- >>> MIGRATION: 20260325131923_d5bca11e-53de-46e5-a1d4-2f51be2ece05.sql <<<
-- =============================================
-- MENUFOOD SaaS - Multi-Tenant Database Schema
-- =============================================

-- 1. ENUM TYPES
CREATE TYPE public.app_role AS ENUM ('super_admin', 'finance', 'support', 'commercial', 'owner', 'manager', 'attendant', 'kitchen');
CREATE TYPE public.restaurant_status AS ENUM ('active', 'trial', 'overdue', 'suspended', 'cancelled');
CREATE TYPE public.subscription_status AS ENUM (
  'trial', 'active', 'overdue', 'suspended', 'cancelled',
  'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);
CREATE TYPE public.order_status AS ENUM ('new', 'accepted', 'preparing', 'ready', 'delivering', 'waiting_pickup', 'completed', 'cancelled');
CREATE TYPE public.order_type AS ENUM ('delivery', 'pickup', 'dine_in', 'quick_sale');
CREATE TYPE public.plan_tier AS ENUM ('basic', 'professional', 'premium');

-- 2. UTILITY FUNCTION: update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. PROFILES (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. USER ROLES (RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  restaurant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, restaurant_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_role(_user_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- 5. SUBSCRIPTION PLANS
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier plan_tier NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_users INT NOT NULL DEFAULT 1,
  max_coupons INT NOT NULL DEFAULT 0,
  advanced_reports BOOLEAN NOT NULL DEFAULT false,
  custom_domain BOOLEAN NOT NULL DEFAULT false,
  visual_customization BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Super admins can manage plans" ON public.subscription_plans FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- 6. RESTAURANTS
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  banner_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  status restaurant_status NOT NULL DEFAULT 'trial',
  is_open BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX idx_restaurants_owner ON public.restaurants(owner_id);

CREATE POLICY "Public can view active restaurants" ON public.restaurants FOR SELECT USING (status IN ('active', 'trial'));
CREATE POLICY "Super admins full access restaurants" ON public.restaurants FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can view own" ON public.restaurants FOR SELECT USING (public.has_restaurant_role(auth.uid(), id));
CREATE POLICY "Restaurant owner can update own" ON public.restaurants FOR UPDATE USING (owner_id = auth.uid());

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RESTAURANT SETTINGS
CREATE TABLE public.restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  pickup_enabled BOOLEAN NOT NULL DEFAULT true,
  dine_in_enabled BOOLEAN NOT NULL DEFAULT false,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  estimated_prep_time INT DEFAULT 30,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  payment_methods JSONB DEFAULT '["pix","cash","credit_card","debit_card"]'::jsonb,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  primary_color TEXT DEFAULT '#F97316',
  secondary_color TEXT DEFAULT '#1a1a2e',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view settings" ON public.restaurant_settings FOR SELECT USING (true);
CREATE POLICY "Super admins full access settings" ON public.restaurant_settings FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant owner can update settings" ON public.restaurant_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid())
);
CREATE TRIGGER update_restaurant_settings_updated_at BEFORE UPDATE ON public.restaurant_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  platform_fee_percent NUMERIC(5,2) DEFAULT 0,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins full access subscriptions" ON public.subscriptions FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant owner can view own subscription" ON public.subscriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid())
);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_categories_restaurant ON public.categories(restaurant_id);
CREATE POLICY "Public can view active categories" ON public.categories FOR SELECT USING (active = true);
CREATE POLICY "Super admins full access categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can manage categories" ON public.categories FOR ALL USING (public.has_restaurant_role(auth.uid(), restaurant_id));
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  promo_price NUMERIC(10,2),
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  sold_out BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_restaurant ON public.products(restaurant_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE POLICY "Public can view active products" ON public.products FOR SELECT USING (active = true);
CREATE POLICY "Super admins full access products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can manage products" ON public.products FOR ALL USING (public.has_restaurant_role(auth.uid(), restaurant_id));
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. PRODUCT OPTION GROUPS
CREATE TABLE public.product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  min_selections INT NOT NULL DEFAULT 0,
  max_selections INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view option groups" ON public.product_option_groups FOR SELECT USING (true);
CREATE POLICY "Super admins full access option groups" ON public.product_option_groups FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can manage option groups" ON public.product_option_groups FOR ALL USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_restaurant_role(auth.uid(), p.restaurant_id))
);

-- 12. PRODUCT OPTIONS
CREATE TABLE public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view options" ON public.product_options FOR SELECT USING (active = true);
CREATE POLICY "Super admins full access options" ON public.product_options FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can manage options" ON public.product_options FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.product_option_groups g
    JOIN public.products p ON p.id = g.product_id
    WHERE g.id = group_id AND public.has_restaurant_role(auth.uid(), p.restaurant_id)
  )
);

-- 13. CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  total_orders INT NOT NULL DEFAULT 0,
  total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_restaurant ON public.customers(restaurant_id);
CREATE INDEX idx_customers_user ON public.customers(user_id);
CREATE POLICY "Super admins full access customers" ON public.customers FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can view own customers" ON public.customers FOR SELECT USING (public.has_restaurant_role(auth.uid(), restaurant_id));
CREATE POLICY "Users can view own customer records" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customer records" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. ADDRESSES
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Casa',
  street TEXT NOT NULL,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL,
  state TEXT,
  zip_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins full access addresses" ON public.addresses FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can manage own addresses" ON public.addresses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

-- 15. COUPONS
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, code)
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active coupons" ON public.coupons FOR SELECT USING (active = true);
CREATE POLICY "Super admins full access coupons" ON public.coupons FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can manage coupons" ON public.coupons FOR ALL USING (public.has_restaurant_role(auth.uid(), restaurant_id));

-- 16. ORDERS (with realtime)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  number SERIAL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  type order_type NOT NULL DEFAULT 'delivery',
  status order_status NOT NULL DEFAULT 'new',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  address TEXT,
  notes TEXT,
  coupon_id UUID REFERENCES public.coupons(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

CREATE POLICY "Super admins full access orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can manage orders" ON public.orders FOR ALL USING (public.has_restaurant_role(auth.uid(), restaurant_id));
CREATE POLICY "Customers can view own orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 17. ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  name TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins full access order items" ON public.order_items FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant staff can view order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.has_restaurant_role(auth.uid(), o.restaurant_id))
);
CREATE POLICY "Customers can view own order items" ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = order_id AND c.user_id = auth.uid()
  )
);
CREATE POLICY "Anyone can insert order items" ON public.order_items FOR INSERT WITH CHECK (true);

-- 18. FINANCIAL TRANSACTIONS
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  type TEXT NOT NULL CHECK (type IN ('order_revenue', 'subscription_payment', 'platform_fee', 'refund')),
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_financial_restaurant ON public.financial_transactions(restaurant_id);
CREATE POLICY "Super admins full access financial" ON public.financial_transactions FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Restaurant owner can view own financial" ON public.financial_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid())
);

-- 19. AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
CREATE POLICY "Super admins can view logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Anyone can insert logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- 20. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('restaurant-assets', 'restaurant-assets', true);

CREATE POLICY "Public can view restaurant assets" ON storage.objects FOR SELECT USING (bucket_id = 'restaurant-assets');
CREATE POLICY "Authenticated can upload restaurant assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'restaurant-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update restaurant assets" ON storage.objects FOR UPDATE USING (bucket_id = 'restaurant-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete restaurant assets" ON storage.objects FOR DELETE USING (bucket_id = 'restaurant-assets' AND auth.role() = 'authenticated');

-- 21. SEED: Subscription Plans
INSERT INTO public.subscription_plans (name, tier, price, max_users, max_coupons, advanced_reports, custom_domain, visual_customization, description, features) VALUES
  ('Básico', 'basic', 97.00, 2, 3, false, false, false, 'Ideal para começar', '["Cardápio online", "Pedidos ilimitados", "2 usuários", "Suporte por email"]'::jsonb),
  ('Profissional', 'professional', 197.00, 5, 10, true, false, true, 'Para restaurantes em crescimento', '["Tudo do Básico", "5 usuários", "Relatórios avançados", "Cupons ilimitados", "Personalização visual", "Suporte prioritário"]'::jsonb),
  ('Premium', 'premium', 397.00, 99, 999, true, true, true, 'Controle total do seu negócio', '["Tudo do Profissional", "Usuários ilimitados", "Domínio próprio", "Integrações", "Gerente dedicado"]'::jsonb);

-- >>> MIGRATION: 20260325131940_d4ccb617-3a89-4d70-b6f9-c6dd52364ebb.sql <<<
-- Fix audit_logs: require authenticated users to insert
DROP POLICY "Anyone can insert logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Fix order_items: tie insert to the order's existence
DROP POLICY "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Authenticated users can insert order items" ON public.order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Fix orders: require authentication to create orders
DROP POLICY "Anyone can create orders" ON public.orders;
CREATE POLICY "Authenticated users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- >>> MIGRATION: 20260329152134_4898b739-3c41-4925-b68e-712042640edc.sql <<<
-- Tables for dine-in (mesas)
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  number integer NOT NULL,
  label text,
  qr_code_url text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'inactive')),
  capacity integer DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, number)
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active tables" ON public.restaurant_tables
  FOR SELECT USING (status != 'inactive');

CREATE POLICY "Restaurant staff can manage tables" ON public.restaurant_tables
  FOR ALL USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access tables" ON public.restaurant_tables
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Waiter calls / bill requests
CREATE TABLE public.waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'call_waiter' CHECK (type IN ('call_waiter', 'request_bill')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create waiter calls" ON public.waiter_calls
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view waiter calls" ON public.waiter_calls
  FOR SELECT USING (true);

CREATE POLICY "Restaurant staff can manage waiter calls" ON public.waiter_calls
  FOR ALL USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access waiter calls" ON public.waiter_calls
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Enable realtime for waiter calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;

-- Add couvert and service fee to restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN couvert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN couvert_value numeric DEFAULT 0,
  ADD COLUMN service_fee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN service_fee_percent numeric DEFAULT 10;

-- Add table_id to orders for dine-in
ALTER TABLE public.orders
  ADD COLUMN table_id uuid REFERENCES public.restaurant_tables(id);

-- >>> MIGRATION: 20260329152149_02ea0b85-da11-4d25-bd13-a0afecc90622.sql <<<
-- Fix the overly permissive INSERT policy - scope to specific table context
DROP POLICY "Anyone can create waiter calls" ON public.waiter_calls;
DROP POLICY "Anyone can view waiter calls" ON public.waiter_calls;

-- Allow anonymous inserts only (customers at tables)
CREATE POLICY "Anon can create waiter calls" ON public.waiter_calls
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only restaurant staff + super admins can view (covered by existing ALL policies)
-- Add anon select scoped to their own calls
CREATE POLICY "Anon can view recent waiter calls" ON public.waiter_calls
  FOR SELECT TO anon USING (created_at > now() - interval '4 hours');

-- >>> MIGRATION: 20260402165246_90d9df03-22e4-46ae-98fa-facfe963cb53.sql <<<
-- Allow anon users to insert orders (public menu / dine-in flow)
CREATE POLICY "Anon can create orders"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon users to insert order items
CREATE POLICY "Anon can insert order items"
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to view their recent orders (last 4h)
CREATE POLICY "Anon can view recent orders"
ON public.orders
FOR SELECT
TO anon
USING (created_at > now() - interval '4 hours');

-- Allow anon to view order items of recent orders
CREATE POLICY "Anon can view recent order items"
ON public.order_items
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_items.order_id
  AND o.created_at > now() - interval '4 hours'
));

-- >>> MIGRATION: 20260402194400_0585913c-eb4c-46ac-b997-221d6a7b0dab.sql <<<
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Authenticated users can insert notifications
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Super admins full access
CREATE POLICY "Super admins full access notifications"
ON public.notifications FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Index for fast lookup
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- >>> MIGRATION: 20260402194912_2a3e9fad-29f0-4f0d-ba41-c1080203dd16.sql <<<
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access platform_settings"
  ON public.platform_settings FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can read platform_settings"
  ON public.platform_settings FOR SELECT
  USING (true);

-- Seed default values
INSERT INTO public.platform_settings (key, value) VALUES
  ('platform_name', 'MeuBar'),
  ('domain', 'meubar.com.br'),
  ('support_email', 'suporte@meubar.com.br'),
  ('support_whatsapp', '(11) 99999-9999'),
  ('trial_days', '14'),
  ('terms_url', 'https://meubar.com.br/termos'),
  ('privacy_url', 'https://meubar.com.br/privacidade'),
  ('primary_color', '#F97316'),
  ('secondary_color', '#1a1a2e'),
  ('notify_new_restaurant', 'true'),
  ('notify_overdue', 'true'),
  ('notify_cancelled', 'true'),
  ('notify_trial_expiring', 'true'),
  ('notify_weekly_report', 'false'),
  ('notify_monthly_report', 'false'),
  ('notify_high_value_orders', 'false'),
  ('require_2fa', 'false'),
  ('session_timeout', '480'),
  ('max_login_attempts', '5'),
  ('lockout_minutes', '15'),
  ('require_strong_password', 'true'),
  ('payment_gateway', 'Stripe'),
  ('default_platform_fee', '3'),
  ('setup_fee', '0'),
  ('overdue_grace_days', '5'),
  ('auto_suspend_days', '15'),
  ('auto_billing', 'true'),
  ('auto_invoice', 'false');

-- >>> MIGRATION: 20260402201010_37d86fd6-0b33-46f5-b9a9-268fb99ab6b4.sql <<<
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- >>> MIGRATION: 20260402201132_d2b10a32-bb9c-4750-a155-f748b295e623.sql <<<
ALTER TABLE public.restaurants ADD COLUMN force_closed boolean NOT NULL DEFAULT false;

-- >>> MIGRATION: 20260402202323_f666a498-e549-4586-8fe9-d7aac49d9555.sql <<<
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

-- >>> MIGRATION: 20260402202810_cfac7eec-20e7-49ec-8c1c-c234bfcf2717.sql <<<
ALTER TABLE public.waiter_calls REPLICA IDENTITY FULL;

-- >>> MIGRATION: 20260402205109_08884309-72d9-4db9-af16-74e33679529a.sql <<<
CREATE TABLE public.table_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_sessions_restaurant ON public.table_sessions(restaurant_id);
CREATE INDEX idx_table_sessions_table ON public.table_sessions(table_id);
CREATE UNIQUE INDEX idx_table_sessions_unique ON public.table_sessions(table_id, session_id);

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- Anon can insert sessions
CREATE POLICY "Anon can insert table sessions"
ON public.table_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anon can update own session (by session_id)
CREATE POLICY "Anon can update table sessions"
ON public.table_sessions FOR UPDATE
TO anon, authenticated
USING (true);

-- Anyone can view recent sessions
CREATE POLICY "Anyone can view recent table sessions"
ON public.table_sessions FOR SELECT
TO anon, authenticated
USING (last_seen_at > (now() - interval '4 hours'));

-- Restaurant staff full access
CREATE POLICY "Restaurant staff can manage table sessions"
ON public.table_sessions FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id));

-- Super admins full access
CREATE POLICY "Super admins full access table sessions"
ON public.table_sessions FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime
ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;

-- >>> MIGRATION: 20260402210617_e166b1ca-8d1a-4e41-8fb2-468eb7811883.sql <<<
ALTER TABLE public.table_sessions ADD CONSTRAINT table_sessions_table_id_session_id_key UNIQUE (table_id, session_id);

-- >>> MIGRATION: 20260404142155_d13e3c26-4c1a-4075-814f-10c15a46ca9a.sql <<<
ALTER TABLE public.categories ADD COLUMN skip_kitchen boolean NOT NULL DEFAULT false;

-- >>> MIGRATION: 20260404142558_523ada64-6717-4716-b40b-679332d835a3.sql <<<
ALTER TABLE public.order_items
  DROP CONSTRAINT order_items_product_id_fkey,
  ADD CONSTRAINT order_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id)
    ON DELETE SET NULL;

-- >>> MIGRATION: 20260406170545_49069cea-b6b0-4100-aaae-b83b7e735d5e.sql <<<
-- Fix: allow authenticated users to also create orders (for dine-in from logged-in browsers)
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
CREATE POLICY "Authenticated users can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix: allow authenticated users to also insert order items
DROP POLICY IF EXISTS "Authenticated users can insert order items" ON public.order_items;
CREATE POLICY "Authenticated users can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- >>> MIGRATION: 20260406170821_cb6e3454-6f61-43fd-b9fd-cb587c7ff045.sql <<<
DROP POLICY IF EXISTS "Anon can view recent orders" ON public.orders;
CREATE POLICY "Anon and authenticated can view recent orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));

DROP POLICY IF EXISTS "Anon can view recent order items" ON public.order_items;
CREATE POLICY "Anon and authenticated can view recent order items"
ON public.order_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > (now() - interval '4 hours')
  )
);

-- >>> MIGRATION: 20260406170828_cc4db7a4-ebf7-4fb2-87fa-93385652d77f.sql <<<
DROP POLICY IF EXISTS "Anon can view recent waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon and authenticated can view recent waiter calls"
ON public.waiter_calls
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));

-- >>> MIGRATION: 20260406170838_d3c52e60-61d3-4fae-abec-c30eb6e9ecf2.sql <<<
SELECT 1;

-- >>> MIGRATION: 20260406170910_f9b186c2-bd55-4ff2-85ad-e9672c6637cb.sql <<<
DROP POLICY IF EXISTS "Anon can view recent orders" ON public.orders;
DROP POLICY IF EXISTS "Anon and authenticated can view recent orders" ON public.orders;
CREATE POLICY "Anon and authenticated can view recent orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));

DROP POLICY IF EXISTS "Anon can view recent order items" ON public.order_items;
DROP POLICY IF EXISTS "Anon and authenticated can view recent order items" ON public.order_items;
CREATE POLICY "Anon and authenticated can view recent order items"
ON public.order_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > (now() - interval '4 hours')
  )
);

-- >>> MIGRATION: 20260406170915_08862e93-058e-4f97-b533-3920ee11945b.sql <<<
DROP POLICY IF EXISTS "Anon can view recent waiter calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Anon and authenticated can view recent waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon and authenticated can view recent waiter calls"
ON public.waiter_calls
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));

-- >>> MIGRATION: 20260406170925_3d8c081e-c5ff-458e-ba41-bbde6961fae5.sql <<<
SELECT 1;

-- >>> MIGRATION: 20260406170944_9c21e376-0c8b-4ee6-8b21-f34b2f2933a6.sql <<<
DROP POLICY IF EXISTS "Anon can view recent orders" ON public.orders;
DROP POLICY IF EXISTS "Anon and authenticated can view recent orders" ON public.orders;
CREATE POLICY "Anon and authenticated can view recent orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));

DROP POLICY IF EXISTS "Anon can view recent order items" ON public.order_items;
DROP POLICY IF EXISTS "Anon and authenticated can view recent order items" ON public.order_items;
CREATE POLICY "Anon and authenticated can view recent order items"
ON public.order_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > (now() - interval '4 hours')
  )
);

-- >>> MIGRATION: 20260406170954_1930559a-e40d-44bb-97a6-f512731bceb9.sql <<<
DROP POLICY IF EXISTS "Anon can view recent waiter calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Anon and authenticated can view recent waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon and authenticated can view recent waiter calls"
ON public.waiter_calls
FOR SELECT
TO anon, authenticated
USING (created_at > (now() - interval '4 hours'));

-- >>> MIGRATION: 20260406171008_60272f83-8664-41c2-9e43-b013a0132457.sql <<<
SELECT 1;

-- >>> MIGRATION: 20260406182741_73bb58d7-f41f-4de1-a561-8124d74f033f.sql <<<
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

-- >>> MIGRATION: 20260406185638_49a2d514-a8a9-4ea6-86a5-8524c8592f71.sql <<<
CREATE TABLE public.cashier_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  initial_cash numeric NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_cash numeric,
  expected_cash numeric,
  cash_difference numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff can manage cashier sessions"
ON public.cashier_sessions FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access cashier sessions"
ON public.cashier_sessions FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_cashier_sessions_restaurant ON public.cashier_sessions(restaurant_id, opened_at DESC);

-- Cashier movements (suprimentos e sangrias)
CREATE TABLE IF NOT EXISTS public.cashier_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cashier_sessions(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('supply', 'bleed')),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashier_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff can manage cashier movements"
ON public.cashier_movements FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access cashier movements"
ON public.cashier_movements FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cashier_movements_session ON public.cashier_movements(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashier_movements_restaurant ON public.cashier_movements(restaurant_id);

-- Atomic Table Settlement RPC
CREATE OR REPLACE FUNCTION public.close_table_settlement(
  _table_id uuid,
  _restaurant_id uuid,
  _payment_method text DEFAULT NULL,
  _close_unpaid boolean DEFAULT false,
  _user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_orders numeric := 0;
  _total_paid numeric := 0;
  _remaining numeric := 0;
  _orders_count int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    has_restaurant_role(auth.uid(), _restaurant_id) OR has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_tables
    WHERE id = _table_id AND restaurant_id = _restaurant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mesa não encontrada ou não pertence ao restaurante.');
  END IF;

  SELECT COALESCE(SUM(total), 0), COUNT(id)
  INTO _total_orders, _orders_count
  FROM public.orders
  WHERE table_id = _table_id
    AND status NOT IN ('completed', 'cancelled');

  SELECT COALESCE(SUM(amount), 0)
  INTO _total_paid
  FROM public.table_partial_payments
  WHERE table_id = _table_id
    AND closed = false;

  _remaining := GREATEST(0, _total_orders - _total_paid);

  IF _remaining > 0.01 AND NOT _close_unpaid THEN
    IF _payment_method IS NOT NULL AND _payment_method <> '' THEN
      INSERT INTO public.table_partial_payments (
        restaurant_id, table_id, amount, people_count, payment_method, paid_by, created_by, closed
      ) VALUES (
        _restaurant_id, _table_id, _remaining, 1, _payment_method, 'Fechamento de Mesa', _user_id, true
      );

      INSERT INTO public.financial_transactions (
        restaurant_id, amount, type, description
      ) VALUES (
        _restaurant_id, _remaining, 'order_revenue', 'Fechamento de mesa (' || _payment_method || ')'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'unpaid_balance',
        'remaining', _remaining,
        'total_orders', _total_orders,
        'total_paid', _total_paid
      );
    END IF;
  END IF;

  UPDATE public.table_partial_payments
  SET closed = true
  WHERE table_id = _table_id AND closed = false;

  UPDATE public.table_commands
  SET status = 'closed', closed_at = now(), updated_at = now()
  WHERE table_id = _table_id AND status = 'open';

  UPDATE public.table_sessions
  SET status = 'closed'
  WHERE table_id = _table_id AND status = 'active';

  IF _orders_count > 0 THEN
    UPDATE public.orders
    SET status = 'completed',
        payment_status = 'paid',
        payment_method = COALESCE(payment_method, _payment_method, 'multiple')
    WHERE table_id = _table_id
      AND status NOT IN ('completed', 'cancelled');
  END IF;

  UPDATE public.restaurant_tables
  SET status = 'available'
  WHERE id = _table_id;

  RETURN jsonb_build_object(
    'success', true,
    'table_id', _table_id,
    'settled_amount', _remaining,
    'orders_closed', _orders_count
  );
END;
$$;

-- >>> MIGRATION: 20260406190602_86babe52-6aeb-48b3-8b6c-297be298e186.sql <<<
-- Allow anon and authenticated to insert customers (auto-create from public orders)
CREATE POLICY "Anon can insert customers"
ON public.customers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow restaurant staff to update customers
CREATE POLICY "Restaurant staff can update customers"
ON public.customers
FOR UPDATE
USING (has_restaurant_role(auth.uid(), restaurant_id));

-- Allow restaurant staff to delete customers
CREATE POLICY "Restaurant staff can delete customers"
ON public.customers
FOR DELETE
USING (has_restaurant_role(auth.uid(), restaurant_id));

-- >>> MIGRATION: 20260406201114_9931c62b-3667-4349-b858-07a6433c1ac9.sql <<<
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- >>> MIGRATION: 20260406203653_33cae75f-ab97-47bb-900f-8efcdf96acd4.sql <<<
CREATE POLICY "Restaurant staff can insert financial transactions"
ON public.financial_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

-- >>> MIGRATION: 20260406203836_df314678-a46a-48a3-8edb-15fd6ceaf7b6.sql <<<
CREATE POLICY "Public can view suspended restaurants"
ON public.restaurants
FOR SELECT
USING (status IN ('suspended', 'cancelled', 'overdue'));

-- >>> MIGRATION: 20260407034935_ef3904a0-e78c-4444-aa8d-612fca5e465d.sql <<<
CREATE TABLE public.delivery_drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  vehicle text NOT NULL DEFAULT 'moto',
  status text NOT NULL DEFAULT 'offline',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff can manage drivers"
  ON public.delivery_drivers FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access drivers"
  ON public.delivery_drivers FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_delivery_drivers_updated_at
  BEFORE UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add driver assignment to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.delivery_drivers(id);

-- >>> MIGRATION: 20260407112903_7eb70116-697d-47e0-93e2-2dba0b3eedc8.sql <<<
-- Inventory items (raw ingredients/supplies)
CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  supplier text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link products to ingredients
CREATE TABLE public.product_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_used numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, inventory_item_id)
);

-- RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

-- Inventory items policies
CREATE POLICY "Restaurant staff can manage inventory"
  ON public.inventory_items FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access inventory"
  ON public.inventory_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Product ingredients policies
CREATE POLICY "Restaurant staff can manage product ingredients"
  ON public.product_ingredients FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_ingredients.product_id
    AND has_restaurant_role(auth.uid(), p.restaurant_id)
  ));

CREATE POLICY "Super admins full access product ingredients"
  ON public.product_ingredients FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Updated_at triggers
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to deduct stock when order is accepted/ready and restore on cancellation
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) DEDUCTION: When order transitions to any active/ready/completed state and stock was not yet deducted
  IF (NEW.status IN ('accepted', 'preparing', 'ready', 'waiting_pickup', 'delivering', 'completed'))
     AND (COALESCE(OLD.stock_deducted, false) = false) THEN

    -- Deduct inventory based on recipes / ingredients
    UPDATE public.inventory_items ii
    SET current_stock = ii.current_stock - (pi.quantity_used * oi.qty)
    FROM public.order_items oi
    JOIN public.product_ingredients pi ON pi.product_id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND pi.inventory_item_id = ii.id;

    -- Mark products as sold_out if any ingredient is now below or equal to min_stock
    UPDATE public.products p
    SET sold_out = true
    WHERE p.restaurant_id = NEW.restaurant_id
      AND p.sold_out = false
      AND EXISTS (
        SELECT 1 FROM public.product_ingredients pi2
        JOIN public.inventory_items ii2 ON ii2.id = pi2.inventory_item_id
        WHERE pi2.product_id = p.id
          AND ii2.current_stock <= ii2.min_stock
      );

    NEW.stock_deducted := true;
  END IF;

  -- 2) RESTORATION: When order is cancelled after stock was previously deducted
  IF (NEW.status = 'cancelled')
     AND (COALESCE(OLD.stock_deducted, false) = true) THEN

    -- Restore inventory
    UPDATE public.inventory_items ii
    SET current_stock = ii.current_stock + (pi.quantity_used * oi.qty)
    FROM public.order_items oi
    JOIN public.product_ingredients pi ON pi.product_id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND pi.inventory_item_id = ii.id;

    -- Re-enable products (unmark sold_out) if all ingredients are now above min_stock
    UPDATE public.products p
    SET sold_out = false
    WHERE p.restaurant_id = NEW.restaurant_id
      AND p.sold_out = true
      AND NOT EXISTS (
        SELECT 1 FROM public.product_ingredients pi3
        JOIN public.inventory_items ii3 ON ii3.id = pi3.inventory_item_id
        WHERE pi3.product_id = p.id
          AND ii3.current_stock <= ii3.min_stock
      );

    NEW.stock_deducted := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deduct_stock_trigger ON public.orders;
CREATE TRIGGER deduct_stock_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order();

-- Indexes
CREATE INDEX idx_inventory_items_restaurant ON public.inventory_items(restaurant_id);
CREATE INDEX idx_product_ingredients_product ON public.product_ingredients(product_id);
CREATE INDEX idx_product_ingredients_inventory ON public.product_ingredients(inventory_item_id);

-- >>> MIGRATION: 20260407145139_99444f01-e18a-4a97-83cb-322321ddeb8f.sql <<<
ALTER TABLE public.restaurant_settings
ADD COLUMN telegram_chat_id text DEFAULT NULL;

-- >>> MIGRATION: 20260420210450_61f36bb3-93b0-494d-a31b-8e7c1fdf4a78.sql <<<
UPDATE public.subscription_plans SET price = 109.90 WHERE tier = 'basic';
UPDATE public.subscription_plans SET price = 249.90 WHERE tier = 'professional';
UPDATE public.subscription_plans SET price = 499.00 WHERE tier = 'premium';

-- >>> MIGRATION: 20260420214129_557c54df-4d60-4abe-a5dd-529b7022bfc7.sql <<<
CREATE TABLE public.table_partial_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  table_id UUID NOT NULL,
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  paid_by TEXT,
  created_by UUID,
  closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpp_table ON public.table_partial_payments(table_id, closed);
CREATE INDEX idx_tpp_restaurant ON public.table_partial_payments(restaurant_id);

ALTER TABLE public.table_partial_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage partial payments"
ON public.table_partial_payments
FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access partial payments"
ON public.table_partial_payments
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- >>> MIGRATION: 20260420220230_10f832d0-36bc-41ae-87ea-5c2377ef378e.sql <<<
-- Tabela de comandas individuais por mesa
CREATE TABLE public.table_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_commands_table ON public.table_commands(table_id, status);
CREATE INDEX idx_table_commands_restaurant ON public.table_commands(restaurant_id);

ALTER TABLE public.table_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage commands"
ON public.table_commands FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access commands"
ON public.table_commands FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anon can view recent commands"
ON public.table_commands FOR SELECT
TO anon, authenticated
USING (opened_at > now() - interval '4 hours');

CREATE POLICY "Anon can insert commands"
ON public.table_commands FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE TRIGGER update_table_commands_updated_at
BEFORE UPDATE ON public.table_commands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular itens de pedido a uma comanda específica (opcional)
ALTER TABLE public.order_items
ADD COLUMN command_id UUID REFERENCES public.table_commands(id) ON DELETE SET NULL;

CREATE INDEX idx_order_items_command ON public.order_items(command_id);

-- >>> MIGRATION: 20260420220822_8abf969b-9f81-40fb-95ec-72afbabe6ea4.sql <<<
-- Expense Categories
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#F97316',
  icon TEXT DEFAULT 'receipt',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage expense categories"
ON public.expense_categories FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access expense categories"
ON public.expense_categories FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  supplier TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | overdue | cancelled
  payment_method TEXT,
  recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT, -- monthly | weekly | yearly
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_restaurant ON public.expenses(restaurant_id);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_due_date ON public.expenses(due_date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage expenses"
ON public.expenses FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access expenses"
ON public.expenses FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table Reservations
CREATE TABLE public.table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  table_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  people_count INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | seated | cancelled | no_show
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_restaurant ON public.table_reservations(restaurant_id);
CREATE INDEX idx_reservations_date ON public.table_reservations(reservation_date);

ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can create reservations"
ON public.table_reservations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Restaurant staff manage reservations"
ON public.table_reservations FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access reservations"
ON public.table_reservations FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_reservations_updated_at
BEFORE UPDATE ON public.table_reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Satisfaction Surveys (NPS)
CREATE TABLE public.satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  order_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  category TEXT GENERATED ALWAYS AS (
    CASE
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'passive'
      ELSE 'detractor'
    END
  ) STORED,
  comment TEXT,
  food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_surveys_restaurant ON public.satisfaction_surveys(restaurant_id);
CREATE INDEX idx_surveys_order ON public.satisfaction_surveys(order_id);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can submit surveys"
ON public.satisfaction_surveys FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can view surveys"
ON public.satisfaction_surveys FOR SELECT
USING (true);

CREATE POLICY "Restaurant staff manage surveys"
ON public.satisfaction_surveys FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access surveys"
ON public.satisfaction_surveys FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- >>> MIGRATION: 20260420221339_d0e603a7-6203-45cc-94d7-ac22cfe05c36.sql <<<
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sold_by_weight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS price_per_kg numeric;

-- >>> MIGRATION: 20260420222019_2f8c24d1-8b25-4750-8d29-09c6019ccad8.sql <<<
-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Generic dispatcher: calls the telegram-notify edge function with an event payload
CREATE OR REPLACE FUNCTION public.notify_telegram_event(
  _restaurant_id uuid,
  _event_type text,
  _payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _anon_key text;
BEGIN
  -- Read function URL + anon key from platform_settings (configurable, no hardcoded secrets in code)
  SELECT value INTO _url FROM platform_settings WHERE key = 'telegram_notify_url';
  SELECT value INTO _anon_key FROM platform_settings WHERE key = 'telegram_notify_anon_key';

  IF _url IS NULL OR _anon_key IS NULL THEN
    RETURN; -- not configured yet
  END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'restaurant_id', _restaurant_id,
      'event_type', _event_type,
      'payload', _payload
    )
  );
END;
$$;

-- ===== Trigger: New order =====
CREATE OR REPLACE FUNCTION public.trg_telegram_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_telegram_event(
    NEW.restaurant_id,
    'new_order',
    jsonb_build_object(
      'order_id', NEW.id,
      'number', NEW.number,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'type', NEW.type,
      'total', NEW.total,
      'address', NEW.address,
      'payment_method', NEW.payment_method
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_new_order_trigger ON orders;
CREATE TRIGGER telegram_new_order_trigger
AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION trg_telegram_new_order();

-- ===== Trigger: Waiter call =====
CREATE OR REPLACE FUNCTION public.trg_telegram_waiter_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _table_label text;
  _table_number int;
BEGIN
  SELECT label, number INTO _table_label, _table_number
  FROM restaurant_tables WHERE id = NEW.table_id;

  PERFORM notify_telegram_event(
    NEW.restaurant_id,
    'waiter_call',
    jsonb_build_object(
      'call_id', NEW.id,
      'type', NEW.type,
      'table_label', COALESCE(_table_label, 'Mesa ' || _table_number),
      'table_number', _table_number
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_waiter_call_trigger ON waiter_calls;
CREATE TRIGGER telegram_waiter_call_trigger
AFTER INSERT ON waiter_calls
FOR EACH ROW EXECUTE FUNCTION trg_telegram_waiter_call();

-- ===== Trigger: Bad review (NPS detractor, score <= 6) =====
CREATE OR REPLACE FUNCTION public.trg_telegram_bad_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.score <= 6 THEN
    PERFORM notify_telegram_event(
      NEW.restaurant_id,
      'bad_review',
      jsonb_build_object(
        'survey_id', NEW.id,
        'score', NEW.score,
        'customer_name', NEW.customer_name,
        'comment', NEW.comment,
        'food_rating', NEW.food_rating,
        'service_rating', NEW.service_rating,
        'delivery_rating', NEW.delivery_rating
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_bad_review_trigger ON satisfaction_surveys;
CREATE TRIGGER telegram_bad_review_trigger
AFTER INSERT ON satisfaction_surveys
FOR EACH ROW EXECUTE FUNCTION trg_telegram_bad_review();

-- >>> MIGRATION: 20260420222609_498bca53-a088-4423-8948-7006d8750bf7.sql <<<
-- ============================================
-- Telegram staff links (multi-garçom por restaurante)
-- ============================================
CREATE TABLE IF NOT EXISTS public.telegram_staff_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  staff_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_staff_restaurant ON public.telegram_staff_links(restaurant_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_tg_staff_chat ON public.telegram_staff_links(chat_id);

ALTER TABLE public.telegram_staff_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage telegram links"
  ON public.telegram_staff_links FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access telegram links"
  ON public.telegram_staff_links FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- >>> MIGRATION: 20260420223651_05b1461c-1729-4b40-8acb-b77308facaf2.sql <<<
UPDATE public.subscription_plans
SET 
  description = 'Para começar a vender online — ideal para operação solo',
  features = '["PDV completo + caixa", "Cardápio digital com fotos", "Pedidos delivery e retirada", "Até 100 produtos", "2 usuários · 1 caixa", "Notificação WhatsApp para cliente", "Relatórios básicos", "Suporte por e-mail"]'::jsonb
WHERE tier = 'basic';

UPDATE public.subscription_plans
SET 
  description = 'A escolha da maioria dos comércios — operação completa multi-canal',
  features = '["Tudo do Básico", "QR Code na mesa + Cardápio Dine-in", "KDS (tela da cozinha) + impressão térmica 80mm", "App PWA do Garçom com modo offline", "Comandas individuais + Divisão de conta", "Gestão de entregadores (motoboys)", "Controle de estoque + custo por insumo", "Reservas de mesa online", "Pesquisa de satisfação (NPS)", "Cupons de desconto (até 20)", "Multi-caixa (até 3) · 5 usuários", "Relatórios avançados", "Suporte prioritário"]'::jsonb,
  advanced_reports = true,
  visual_customization = true,
  max_users = 5,
  max_coupons = 20
WHERE tier = 'professional';

UPDATE public.subscription_plans
SET 
  description = 'Operação inteligente com IA e bot Telegram completo',
  features = '["Tudo do Profissional", "🤖 Bot Telegram inteligente (comandos /relatorio, /comandas, /mesas, /estoque, /abrir, /fechar)", "✅ Aceitar/recusar pedidos direto pelo Telegram", "👥 Múltiplos garçons vinculados ao bot", "📊 AI Insights — análise de vendas com IA", "🔔 Resumo diário automático às 22h (Top 3 produtos + KPIs)", "🚨 Alertas de estoque baixo no Telegram", "CRM completo de clientes", "Cupons ilimitados", "Domínio personalizado", "API de integração", "Caixas e usuários ilimitados", "SLA garantido", "Gerente de conta dedicado", "Suporte 24/7"]'::jsonb,
  advanced_reports = true,
  visual_customization = true,
  custom_domain = true,
  max_users = 999,
  max_coupons = 999
WHERE tier = 'premium';

-- >>> MIGRATION: 20260421133504_809bd7b3-767c-471f-ad63-6998567f2051.sql <<<
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sla_alert_sent_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_orders_sla_check ON public.orders (status, type, sla_alert_sent_at) WHERE status IN ('preparing','ready','delivering');

-- >>> MIGRATION: 20260421134206_f33d9b78-0648-4a60-86b6-d91432154fbd.sql <<<
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sla_acknowledged_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_orders_sla_ack ON public.orders (restaurant_id, sla_acknowledged_at) WHERE sla_alert_sent_at IS NOT NULL;

-- >>> MIGRATION: 20260421135113_51e021a7-58e5-444d-b4ba-607cbfd1bbd7.sql <<<
CREATE TABLE public.restaurant_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  link_type TEXT NOT NULL DEFAULT 'none',
  link_target TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_banners_link_type_check CHECK (link_type IN ('none','category','product','external'))
);

CREATE INDEX idx_restaurant_banners_restaurant ON public.restaurant_banners (restaurant_id, sort_order);
CREATE INDEX idx_restaurant_banners_active ON public.restaurant_banners (restaurant_id, active) WHERE active = true;

ALTER TABLE public.restaurant_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active banners in window"
ON public.restaurant_banners FOR SELECT
USING (
  active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);

CREATE POLICY "Restaurant staff can manage banners"
ON public.restaurant_banners FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access banners"
ON public.restaurant_banners FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_restaurant_banners_updated_at
BEFORE UPDATE ON public.restaurant_banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- >>> MIGRATION: 20260421151508_efba9237-1d7c-4070-9844-8e8edfd5f942.sql <<<
UPDATE public.restaurants SET is_open = true, force_closed = false WHERE id = 'c438a4c2-3126-4184-b397-114dcbe2c2ad';

-- >>> MIGRATION: 20260421182003_4fc17b71-affe-49cf-930d-6f23a34800a2.sql <<<
UPDATE public.restaurants SET is_open = true, force_closed = false WHERE id = 'c438a4c2-3126-4184-b397-114dcbe2c2ad';

-- >>> MIGRATION: 20260422115836_35ced91f-56f1-463d-8118-de2bf72b9c38.sql <<<
-- 1. Add is_quick_sale flag to products (marks favorites for the quick-sale grid)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_quick_sale boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_quick_sale
  ON public.products (restaurant_id, is_quick_sale)
  WHERE is_quick_sale = true;

-- 2. Add quick-sale toggle + default commission % to restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS quick_sale_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quick_sale_commission_percent numeric NOT NULL DEFAULT 0;

-- 3. Track which staff member served / sold the order (for ranking + commission)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS served_by uuid;

CREATE INDEX IF NOT EXISTS idx_orders_served_by
  ON public.orders (restaurant_id, served_by, created_at DESC)
  WHERE served_by IS NOT NULL;

-- 4. 'quick_sale' already included in initial order_type definition
-- (Skipping ALTER TYPE to avoid PostgreSQL 55P04 error in single transaction)

-- >>> MIGRATION: 20260422122057_945a520c-0446-498d-b315-19644a411e10.sql <<<
UPDATE subscription_plans
SET features = '["Tudo do Básico","⚡ Modo Balada — venda avulsa em 3 toques (NOVO)","QR Code na mesa + Cardápio Dine-in","KDS (tela da cozinha) + impressão térmica 80mm","App PWA do Garçom com modo offline","Comandas individuais + Divisão de conta","Gestão de entregadores (motoboys)","Controle de estoque + custo por insumo","Reservas de mesa online","Pesquisa de satisfação (NPS)","Cupons de desconto (até 20)","Multi-caixa (até 3) · 5 usuários","Relatórios avançados","Suporte prioritário"]'::jsonb
WHERE tier = 'professional';

UPDATE subscription_plans
SET features = '["Tudo do Profissional","⚡ Modo Balada + ranking ao vivo + comissão automática (NOVO)","🤖 Bot Telegram inteligente (comandos /relatorio, /comandas, /mesas, /estoque, /abrir, /fechar)","✅ Aceitar/recusar pedidos direto pelo Telegram","👥 Múltiplos garçons vinculados ao bot","📊 AI Insights — análise de vendas com IA","🔔 Resumo diário automático às 22h (Top 3 produtos + KPIs)","🚨 Alertas de estoque baixo no Telegram","CRM completo de clientes","Cupons ilimitados","Domínio personalizado","API de integração","Caixas e usuários ilimitados","SLA garantido","Gerente de conta dedicado","Suporte 24/7"]'::jsonb
WHERE tier = 'premium';

-- >>> MIGRATION: 20260422142133_98cd51a8-1c81-4292-9a8a-15052d9e5ff5.sql <<<
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mp_init_point text,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  mp_payment_id text,
  mp_preapproval_id text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_restaurant ON public.subscription_payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_subscription ON public.subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_preapproval ON public.subscriptions(mp_preapproval_id);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access subscription_payments"
  ON public.subscription_payments FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Restaurant owner views own payments"
  ON public.subscription_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = subscription_payments.restaurant_id AND r.owner_id = auth.uid()
  ));

-- >>> MIGRATION: 20260422145723_f7a09223-e0b6-466a-beb4-9442803041bf.sql <<<
INSERT INTO public.platform_settings (key, value) VALUES
('legal_terms', E'# Termos de Uso\n\n**Última atualização:** 22 de abril de 2026\n\n## 1. Aceitação dos Termos\nAo se cadastrar e utilizar a plataforma BoraUai ("Plataforma"), você ("Cliente" ou "Estabelecimento") concorda integralmente com estes Termos de Uso e com a Política de Privacidade.\n\n## 2. Descrição do Serviço\nA BoraUai é uma plataforma SaaS que oferece sistema de gestão para restaurantes, bares e estabelecimentos do setor de alimentação, incluindo PDV, cardápio digital, gestão de pedidos, delivery, KDS, comandas, estoque, CRM, relatórios e integrações.\n\n## 3. Cadastro e Conta\n3.1. O Cliente declara que todas as informações fornecidas no cadastro são verdadeiras, completas e atualizadas.\n3.2. É responsabilidade do Cliente manter a confidencialidade de suas credenciais de acesso.\n3.3. O Cliente deve ter no mínimo 18 anos e capacidade jurídica plena.\n\n## 4. Planos e Pagamento\n4.1. A BoraUai oferece os planos Básico, Profissional e Premium.\n4.2. Trial: novos cadastros recebem 14 dias gratuitos para teste.\n4.3. Após o trial, a cobrança é mensal recorrente via Mercado Pago.\n4.4. Falha no pagamento gera status de inadimplência; após período de carência, o acesso é suspenso.\n4.5. O Cliente pode cancelar a assinatura a qualquer momento pelo painel — sem multa, com acesso até o fim do ciclo já pago.\n\n## 5. Obrigações do Cliente\n5.1. Utilizar a Plataforma apenas para fins lícitos.\n5.2. Não revender, sublicenciar ou disponibilizar acesso a terceiros sem autorização.\n5.3. Manter dados de clientes finais em conformidade com a LGPD.\n5.4. Emitir notas fiscais de suas próprias vendas conforme legislação.\n\n## 6. Propriedade Intelectual\nTodo o software, design, código, marca e conteúdo da Plataforma pertencem à BoraUai. O Cliente recebe apenas licença de uso, não-exclusiva e intransferível, durante a vigência da assinatura.\n\n## 7. Disponibilidade e SLA\nA BoraUai compromete-se com disponibilidade média mensal de 99%, excluídos períodos de manutenção programada previamente comunicados.\n\n## 8. Limitação de Responsabilidade\nA BoraUai não se responsabiliza por: (i) lucros cessantes; (ii) falhas de internet do Cliente; (iii) erros operacionais do estabelecimento; (iv) integrações de terceiros (Mercado Pago, Telegram, etc.).\n\n## 9. Rescisão\nEstes Termos vigoram enquanto houver assinatura ativa. A BoraUai pode encerrar a conta em caso de violação destes Termos, fraude ou inadimplência prolongada.\n\n## 10. Foro\nFica eleito o foro da Comarca de [Sua Cidade]/[UF], com renúncia a qualquer outro.\n\n## 11. Contato\nDúvidas: contato@borauai.com.br'),

('legal_privacy', E'# Política de Privacidade\n\n**Última atualização:** 22 de abril de 2026\n\nA BoraUai respeita sua privacidade e está comprometida com a proteção dos dados pessoais que tratamos, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).\n\n## 1. Dados que Coletamos\n**1.1. Do Estabelecimento (Cliente):**\n- Dados cadastrais: nome, e-mail, CNPJ, endereço, telefone\n- Dados financeiros: meio de pagamento, histórico de cobranças\n- Dados de uso: logs de acesso, IP, navegador\n\n**1.2. De Clientes Finais (consumidores do Estabelecimento):**\n- Nome, telefone, e-mail, endereço de entrega\n- Pedidos e histórico de consumo\n\n## 2. Finalidades do Tratamento\n- Prestação dos serviços contratados\n- Cobrança e emissão fiscal\n- Suporte técnico\n- Melhoria da plataforma e experiência do usuário\n- Cumprimento de obrigações legais\n\n## 3. Base Legal\nTratamos dados com base em: execução de contrato, legítimo interesse, cumprimento de obrigação legal e consentimento (quando aplicável).\n\n## 4. Compartilhamento\nCompartilhamos dados apenas com:\n- **Mercado Pago**: processamento de pagamentos\n- **Supabase/Lovable Cloud**: hospedagem e banco de dados\n- **Telegram**: notificações operacionais (opcional)\n- **Autoridades**: quando exigido por lei\n\n## 5. Armazenamento e Segurança\n- Dados armazenados em servidores na nuvem com criptografia em trânsito (TLS) e em repouso\n- Controle de acesso por níveis (RLS — Row Level Security)\n- Backups automáticos diários\n- Multi-tenancy com isolamento entre estabelecimentos\n\n## 6. Seus Direitos (LGPD)\nVocê pode, a qualquer momento, solicitar:\n- Confirmação da existência de tratamento\n- Acesso aos dados\n- Correção de dados incompletos ou desatualizados\n- Anonimização, bloqueio ou eliminação\n- Portabilidade\n- Revogação do consentimento\n\nPara exercer seus direitos: privacidade@borauai.com.br\n\n## 7. Retenção de Dados\n- Dados de cadastro: enquanto durar o contrato + 5 anos (obrigação fiscal)\n- Logs de acesso: 6 meses\n- Dados de pedidos: enquanto durar o contrato\n\n## 8. Cookies\nUtilizamos cookies essenciais para autenticação e funcionamento da plataforma. Não utilizamos cookies de rastreamento publicitário.\n\n## 9. Encarregado de Dados (DPO)\n**Encarregado:** [Nome do DPO]\n**E-mail:** dpo@borauai.com.br\n\n## 10. Alterações\nEsta Política pode ser atualizada. Notificaremos alterações relevantes pelos canais oficiais.'),

('legal_lgpd', E'# LGPD — Lei Geral de Proteção de Dados\n\n**Última atualização:** 22 de abril de 2026\n\nA BoraUai está em conformidade com a Lei nº 13.709/2018 (LGPD). Esta página detalha como cumprimos cada exigência legal e como você pode exercer seus direitos.\n\n## 1. Princípios Aplicados\nTratamos dados pessoais observando os princípios da LGPD: finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização.\n\n## 2. Papéis\n- **Controlador**: o Estabelecimento (quanto aos dados de seus clientes finais)\n- **Operador**: a BoraUai (quanto aos dados tratados em nome do Estabelecimento)\n- **Controlador**: a BoraUai (quanto aos dados cadastrais e financeiros do próprio Estabelecimento)\n\n## 3. Direitos do Titular\nComo titular de dados, você tem direito a: acesso, correção, eliminação, portabilidade, anonimização/bloqueio, informação sobre compartilhamento e revogação de consentimento.\n\nPara exercer: privacidade@borauai.com.br — atendimento em até 15 dias.\n\n## 4. Medidas de Segurança Técnica\n- Criptografia TLS 1.2+ em todas as comunicações\n- Hash de senhas com bcrypt\n- Row Level Security (RLS) no banco de dados\n- Autenticação multi-fator disponível\n- Logs de auditoria\n- Backups criptografados\n\n## 5. Notificação de Incidentes\nEm caso de incidente de segurança envolvendo dados pessoais, a ANPD e os titulares afetados serão comunicados em até 72 horas, conforme Art. 48 da LGPD.\n\n## 6. Transferência Internacional\nOs dados são processados em data centers que podem estar localizados fora do Brasil (Supabase/AWS). Garantimos cláusulas contratuais e nível adequado de proteção.\n\n## 7. Crianças e Adolescentes\nA plataforma não é destinada a menores de 18 anos. Não coletamos intencionalmente dados de menores.\n\n## 8. Encarregado pelo Tratamento de Dados (DPO)\n**Nome:** [Nome do DPO]\n**E-mail:** dpo@borauai.com.br\n**Telefone:** [Telefone]\n\n## 9. Solicitações de Titulares\nEnvie sua solicitação para **privacidade@borauai.com.br** informando: nome completo, e-mail cadastrado, direito a exercer e documento de identificação.\n\n## 10. Autoridade Nacional\nVocê também pode apresentar reclamação à ANPD — Autoridade Nacional de Proteção de Dados:\n**Site:** https://www.gov.br/anpd')
ON CONFLICT (key) DO NOTHING;

-- >>> MIGRATION: 20260422150927_10560476-eca4-4999-9add-a7b205f05405.sql <<<
-- Remove unique constraint on tier (allows multiple plans per tier, e.g. test plans)
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_tier_key;

-- Insert R$ 2,00 test plan
INSERT INTO public.subscription_plans (
  name, tier, price, max_users, max_coupons,
  advanced_reports, custom_domain, visual_customization,
  description, features, active
) VALUES (
  '🧪 Teste R$ 2',
  'basic',
  2.00,
  1,
  1,
  false,
  false,
  false,
  '⚠️ Plano temporário para validar integração com Mercado Pago. Não use comercialmente.',
  '["Plano de teste — apenas para validar cobrança real", "Use uma única vez para confirmar o ciclo MP", "Cancele logo após o teste"]'::jsonb,
  true
);

-- >>> MIGRATION: 20260422182421_df31432e-71e0-4b23-8c83-707323d86789.sql <<<
UPDATE public.subscriptions s
SET monthly_price = p.price,
    updated_at = now()
FROM public.subscription_plans p
WHERE s.plan_id = p.id
  AND s.monthly_price <> p.price;

-- >>> MIGRATION: 20260422184158_20699cf5-1faa-449b-99f4-af79aab01a51.sql <<<
-- Limpa o preapproval travado para permitir gerar um novo limpo
UPDATE public.subscriptions
SET mp_preapproval_id = NULL,
    mp_init_point = NULL,
    updated_at = now()
WHERE mp_preapproval_id = 'b56b3002ac1f43d6a9d3f242624f07b5';

-- >>> MIGRATION: 20260425015434_573b21d3-73df-4272-a971-ccdff7426ebc.sql <<<
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS quick_sale_auto_schedule boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quick_sale_start_time time NULL,
  ADD COLUMN IF NOT EXISTS quick_sale_end_time time NULL,
  ADD COLUMN IF NOT EXISTS quick_sale_active_days integer[] NOT NULL DEFAULT ARRAY[5,6]::integer[],
  ADD COLUMN IF NOT EXISTS quick_sale_welcome_message text NULL,
  ADD COLUMN IF NOT EXISTS quick_sale_thankyou_message text NULL;

-- >>> MIGRATION: 20260425021420_7893441f-a30b-4979-84ce-53c8dc5242f9.sql <<<
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- >>> MIGRATION: 20260425023705_74974f4d-9fb8-425d-85cf-3c48251b5bba.sql <<<
-- 1. Adiciona PIN de 6 dígitos para login do entregador no app PWA
ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS access_pin text,
  ADD COLUMN IF NOT EXISTS last_lat double precision,
  ADD COLUMN IF NOT EXISTS last_lng double precision,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

-- Índice para login rápido por PIN dentro do restaurante
CREATE UNIQUE INDEX IF NOT EXISTS delivery_drivers_pin_unique
  ON public.delivery_drivers (restaurant_id, access_pin)
  WHERE access_pin IS NOT NULL;

-- Função pra gerar PIN único de 6 dígitos no restaurante
CREATE OR REPLACE FUNCTION public.generate_driver_pin(_restaurant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pin text;
  _exists boolean;
  _attempts int := 0;
BEGIN
  LOOP
    _pin := lpad(floor(random() * 1000000)::text, 6, '0');
    SELECT EXISTS(
      SELECT 1 FROM delivery_drivers
      WHERE restaurant_id = _restaurant_id AND access_pin = _pin
    ) INTO _exists;
    EXIT WHEN NOT _exists OR _attempts > 50;
    _attempts := _attempts + 1;
  END LOOP;
  RETURN _pin;
END;
$$;

-- Backfill PIN para entregadores existentes
UPDATE public.delivery_drivers
SET access_pin = public.generate_driver_pin(restaurant_id)
WHERE access_pin IS NULL;

-- 2. Timestamps de despacho e entrega para cronômetro/SLA
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Trigger para preencher dispatched_at quando status vira 'delivering'
CREATE OR REPLACE FUNCTION public.set_order_dispatched_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivering' AND (OLD.status IS DISTINCT FROM 'delivering') AND NEW.dispatched_at IS NULL THEN
    NEW.dispatched_at := now();
  END IF;
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_dispatched ON public.orders;
CREATE TRIGGER trg_set_order_dispatched
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_dispatched_at();

-- 3. RPC pública para login do entregador por PIN (sem auth)
CREATE OR REPLACE FUNCTION public.driver_login(_restaurant_slug text, _pin text)
RETURNS TABLE (driver_id uuid, driver_name text, restaurant_id uuid, restaurant_name text, vehicle text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.name, d.restaurant_id, r.name, d.vehicle
  FROM delivery_drivers d
  JOIN restaurants r ON r.id = d.restaurant_id
  WHERE r.slug = _restaurant_slug
    AND d.access_pin = _pin
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_login(text, text) TO anon, authenticated;

-- 4. RPC pública para o entregador atualizar a própria localização e status (sem auth, validado por PIN+id)
CREATE OR REPLACE FUNCTION public.driver_heartbeat(
  _driver_id uuid,
  _pin text,
  _lat double precision,
  _lng double precision,
  _status text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM delivery_drivers
    WHERE id = _driver_id AND access_pin = _pin
  ) INTO _ok;
  IF NOT _ok THEN
    RETURN false;
  END IF;

  UPDATE delivery_drivers
  SET last_lat = _lat,
      last_lng = _lng,
      last_location_at = now(),
      status = COALESCE(_status, status),
      updated_at = now()
  WHERE id = _driver_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_heartbeat(uuid, text, double precision, double precision, text) TO anon, authenticated;

-- 5. RPC pra entregador marcar pedido como entregue
CREATE OR REPLACE FUNCTION public.driver_mark_delivered(
  _driver_id uuid,
  _pin text,
  _order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM delivery_drivers d
    JOIN orders o ON o.driver_id = d.id
    WHERE d.id = _driver_id AND d.access_pin = _pin AND o.id = _order_id
  ) INTO _ok;
  IF NOT _ok THEN RETURN false; END IF;

  UPDATE orders SET status = 'completed', delivered_at = now(), updated_at = now()
  WHERE id = _order_id;

  -- Libera entregador se não houver mais entregas em andamento
  UPDATE delivery_drivers SET status = 'available'
  WHERE id = _driver_id
    AND NOT EXISTS (
      SELECT 1 FROM orders WHERE driver_id = _driver_id AND status = 'delivering'
    );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_mark_delivered(uuid, text, uuid) TO anon, authenticated;

-- 6. RLS: permite entregador (anon) ler apenas seus próprios pedidos via select com filtro driver_id (controle no client + RPC)
-- Como o app do entregador não usa auth, a leitura dos pedidos atribuídos vai por RPC dedicada:
CREATE OR REPLACE FUNCTION public.driver_list_assigned_orders(_driver_id uuid, _pin text)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery_drivers WHERE id = _driver_id AND access_pin = _pin) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT * FROM orders
    WHERE driver_id = _driver_id
      AND status IN ('delivering', 'ready')
    ORDER BY dispatched_at NULLS LAST, created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_list_assigned_orders(uuid, text) TO anon, authenticated;

-- Habilita realtime para drivers (mapa em tempo real no painel)
ALTER TABLE public.delivery_drivers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;

-- >>> MIGRATION: 20260425024528_9a9c64b9-9728-4615-909e-55031f148902.sql <<<
-- Hot query: dashboard pedidos / KDS / painel entregas
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON public.orders (restaurant_id, status, created_at DESC);

-- Hot query: app entregador (driver_list_assigned_orders) e LiveDeliveriesPanel
CREATE INDEX IF NOT EXISTS idx_orders_driver_status
  ON public.orders (driver_id, status)
  WHERE driver_id IS NOT NULL;

-- Hot query: lista de entregadores no painel
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_restaurant_status
  ON public.delivery_drivers (restaurant_id, status);

-- Hot query: chamadas pendentes
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_status
  ON public.waiter_calls (restaurant_id, status, created_at DESC);

-- Hot query: presença em mesas
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_seen
  ON public.table_sessions (restaurant_id, last_seen_at DESC);

-- Hot query: itens por pedido (joins frequentes)
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

-- Hot query: pedidos por cliente (área do cliente / CRM)
CREATE INDEX IF NOT EXISTS idx_orders_customer
  ON public.orders (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- Hot query: notificações do usuário
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

-- >>> MIGRATION: 20260425025805_7fcdcdf4-2930-4a78-b804-3106dd541192.sql <<<
-- Public function to expose only the GPS of the driver assigned to a specific order
-- Used by customer order tracking page; no auth required, no PII leaked
CREATE OR REPLACE FUNCTION public.get_order_driver_location(_order_id uuid)
RETURNS TABLE(
  driver_name text,
  vehicle text,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  status text,
  order_status order_status,
  order_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.name,
    d.vehicle,
    d.last_lat,
    d.last_lng,
    d.last_location_at,
    d.status,
    o.status,
    o.address
  FROM orders o
  LEFT JOIN delivery_drivers d ON d.id = o.driver_id
  WHERE o.id = _order_id
    AND o.created_at > now() - interval '24 hours'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_driver_location(uuid) TO anon, authenticated;

-- >>> MIGRATION: 20260425153952_0422c4f2-68bf-488b-964d-bfc10919a9d6.sql <<<
-- Áreas de entrega por bairro
CREATE TABLE public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  neighborhood TEXT NOT NULL,
  city TEXT,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  min_order_value NUMERIC DEFAULT 0,
  estimated_time INTEGER DEFAULT 45,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_zones_restaurant ON public.delivery_zones(restaurant_id);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active delivery zones"
  ON public.delivery_zones FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff manage delivery zones"
  ON public.delivery_zones FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access delivery zones"
  ON public.delivery_zones FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_delivery_zones_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Combos / Promoções
CREATE TABLE public.product_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_combos_restaurant ON public.product_combos(restaurant_id);

CREATE TABLE public.product_combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_combo_items_combo ON public.product_combo_items(combo_id);

ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active combos"
  ON public.product_combos FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff manage combos"
  ON public.product_combos FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access combos"
  ON public.product_combos FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Public can view combo items"
  ON public.product_combo_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.product_combos c WHERE c.id = combo_id AND c.active = true));

CREATE POLICY "Restaurant staff manage combo items"
  ON public.product_combo_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.product_combos c WHERE c.id = combo_id AND has_restaurant_role(auth.uid(), c.restaurant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_combos c WHERE c.id = combo_id AND has_restaurant_role(auth.uid(), c.restaurant_id)));

CREATE POLICY "Super admins full access combo items"
  ON public.product_combo_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_product_combos_updated_at
  BEFORE UPDATE ON public.product_combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular zone ao pedido
ALTER TABLE public.orders ADD COLUMN delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- >>> MIGRATION: 20260425155853_1c33161a-4a61-4d62-8237-df48799298ca.sql <<<
-- Tabela de vínculo Telegram do cliente
CREATE TABLE public.customer_telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  chat_id text,
  link_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | active | revoked
  notify_status_updates boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  linked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ctl_customer ON public.customer_telegram_links(customer_id);
CREATE INDEX idx_ctl_chat ON public.customer_telegram_links(chat_id) WHERE chat_id IS NOT NULL;

ALTER TABLE public.customer_telegram_links ENABLE ROW LEVEL SECURITY;

-- Cliente autenticado gerencia seus próprios vínculos
CREATE POLICY "Customers manage own telegram links"
ON public.customer_telegram_links
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid()));

-- Anônimo pode inserir token pendente (caso de pedido sem login — futuro)
CREATE POLICY "Anyone can create pending link tokens"
ON public.customer_telegram_links
FOR INSERT TO anon, authenticated
WITH CHECK (status = 'pending');

CREATE POLICY "Super admin full access ctl"
ON public.customer_telegram_links
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_ctl_updated_at
BEFORE UPDATE ON public.customer_telegram_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: notificar mudança de status do pedido pro cliente
CREATE OR REPLACE FUNCTION public.trg_telegram_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.customer_id IS NOT NULL THEN
    PERFORM notify_telegram_event(
      NEW.restaurant_id,
      'order_status_customer',
      jsonb_build_object(
        'order_id', NEW.id,
        'number', NEW.number,
        'status', NEW.status,
        'customer_id', NEW.customer_id,
        'type', NEW.type,
        'total', NEW.total
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_order_status_change ON public.orders;
CREATE TRIGGER telegram_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_telegram_order_status_change();

-- >>> MIGRATION: 20260425163637_23fd352d-382b-431d-940c-96604326a8b6.sql <<<
-- ============================================
-- FASE 1 + 2: Master Admin Foundation
-- ============================================

-- =====================================================
-- 1. AUDIT LOGS - Triggers automáticos para ações críticas
-- =====================================================

-- Helper function: registra audit log
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _metadata);
END;
$$;

-- Trigger: status do restaurante mudou (suspended, cancelled, etc.)
CREATE OR REPLACE FUNCTION public.trg_audit_restaurant_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'restaurant_status_changed',
      'restaurant',
      NEW.id,
      jsonb_build_object(
        'restaurant_name', NEW.name,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_restaurant_status ON restaurants;
CREATE TRIGGER audit_restaurant_status
AFTER UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION trg_audit_restaurant_status();

-- Trigger: subscription mudou de plano
CREATE OR REPLACE FUNCTION public.trg_audit_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'subscription_changed',
      'subscription',
      NEW.id,
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'old_plan_id', OLD.plan_id,
        'new_plan_id', NEW.plan_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_subscription_change ON subscriptions;
CREATE TRIGGER audit_subscription_change
AFTER UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION trg_audit_subscription_change();

-- Trigger: novo restaurante criado
CREATE OR REPLACE FUNCTION public.trg_audit_restaurant_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'restaurant_created',
    'restaurant',
    NEW.id,
    jsonb_build_object('restaurant_name', NEW.name, 'slug', NEW.slug, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_restaurant_created ON restaurants;
CREATE TRIGGER audit_restaurant_created
AFTER INSERT ON restaurants
FOR EACH ROW EXECUTE FUNCTION trg_audit_restaurant_created();

-- Trigger: platform_settings mudou
CREATE OR REPLACE FUNCTION public.trg_audit_platform_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'platform_setting_changed',
      'platform_setting',
      NEW.id,
      jsonb_build_object('key', NEW.key, 'old_value', OLD.value, 'new_value', NEW.value)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_platform_settings ON platform_settings;
CREATE TRIGGER audit_platform_settings
AFTER UPDATE ON platform_settings
FOR EACH ROW EXECUTE FUNCTION trg_audit_platform_settings();

-- Adicionar coluna motivo no restaurant para suspensão
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- =====================================================
-- 2. FASE 2: Templates de mensagens (master)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.master_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  channel text NOT NULL DEFAULT 'telegram', -- telegram | email | whatsapp | in_app
  subject text,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE master_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access templates"
ON master_message_templates
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON master_message_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed templates iniciais
INSERT INTO master_message_templates (key, name, description, channel, subject, body, variables) VALUES
  ('welcome_restaurant', 'Boas-vindas restaurante', 'Enviado ao criar novo restaurante', 'telegram', NULL,
   E'🎉 Bem-vindo(a) ao MeuBar, *{{nome}}*!\n\nSua conta está ativa no plano *{{plano}}* com trial de {{trial_dias}} dias.\n\n📲 Acesse: {{url_login}}\n📧 E-mail: {{email}}\n\nQualquer dúvida, fale com nosso suporte: {{suporte}}',
   '["nome","plano","trial_dias","url_login","email","suporte"]'::jsonb),
  ('payment_overdue', 'Cobrança - inadimplência', 'Enviado quando subscription fica overdue', 'telegram', NULL,
   E'⚠️ *{{nome}}*, identificamos que sua assinatura está com pagamento em atraso há {{dias_atraso}} dia(s).\n\nValor: R$ {{valor}}\nPlano: {{plano}}\n\nRegularize em: {{url_pagamento}}\n\nApós 7 dias, o acesso será suspenso automaticamente.',
   '["nome","dias_atraso","valor","plano","url_pagamento"]'::jsonb),
  ('subscription_suspended', 'Conta suspensa', 'Enviado ao suspender restaurante', 'telegram', NULL,
   E'🚫 *{{nome}}*, sua conta foi suspensa.\n\nMotivo: {{motivo}}\n\nPara reativar, entre em contato com o suporte: {{suporte}}',
   '["nome","motivo","suporte"]'::jsonb),
  ('trial_expiring', 'Trial expirando', 'Enviado 3 dias antes do trial acabar', 'telegram', NULL,
   E'⏰ *{{nome}}*, seu trial termina em {{dias_restantes}} dia(s)!\n\nPara continuar usando o MeuBar, ative sua assinatura:\n{{url_pagamento}}\n\nPlano sugerido: *{{plano}}* — R$ {{valor}}/mês',
   '["nome","dias_restantes","url_pagamento","plano","valor"]'::jsonb),
  ('broadcast_default', 'Comunicado padrão', 'Template base para comunicados gerais', 'telegram', NULL,
   E'📢 *{{titulo}}*\n\n{{mensagem}}\n\n— Equipe MeuBar',
   '["titulo","mensagem"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 3. FASE 2: Histórico de broadcasts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.master_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid REFERENCES auth.users(id),
  template_key text,
  channel text NOT NULL DEFAULT 'telegram',
  subject text,
  body text NOT NULL,
  segment jsonb DEFAULT '{}'::jsonb, -- { plan_tier?: string, status?: string, restaurant_ids?: uuid[] }
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | sending | completed | failed
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE master_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access broadcasts"
ON master_broadcasts
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- =====================================================
-- 4. FASE 2: Tokens de impersonate
-- =====================================================

CREATE TABLE IF NOT EXISTS public.impersonation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  restaurant_id uuid,
  reason text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE impersonation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access impersonation"
ON impersonation_tokens
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_impersonation_token ON impersonation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- >>> MIGRATION: 20260425164736_2833b733-a1ac-4106-8ea6-5badb61d32ec.sql <<<
-- 1) Cupons globais da plataforma (descontos na assinatura SaaS)
CREATE TABLE public.platform_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  discount_value NUMERIC NOT NULL DEFAULT 0,
  duration_months INTEGER NOT NULL DEFAULT 1, -- por quantos meses aplica o desconto
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  applies_to_tier TEXT, -- null = todos planos, ou 'basic'/'professional'/'premium'
  active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access platform_coupons"
ON public.platform_coupons FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Public can read active platform_coupons"
ON public.platform_coupons FOR SELECT
USING (active = true AND (valid_until IS NULL OR valid_until > now()));

CREATE TRIGGER trg_platform_coupons_updated
BEFORE UPDATE ON public.platform_coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Feature flags por restaurante
CREATE TABLE public.restaurant_feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, flag_key)
);

ALTER TABLE public.restaurant_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access feature_flags"
ON public.restaurant_feature_flags FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Restaurant staff can view own feature flags"
ON public.restaurant_feature_flags FOR SELECT
USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE TRIGGER trg_feature_flags_updated
BEFORE UPDATE ON public.restaurant_feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Histórico de mudanças de plano
CREATE TABLE public.subscription_plan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  subscription_id UUID,
  from_plan_id UUID,
  to_plan_id UUID,
  from_status TEXT,
  to_status TEXT,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access plan_history"
ON public.subscription_plan_history FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Restaurant owner views own plan history"
ON public.subscription_plan_history FOR SELECT
USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE INDEX idx_plan_history_restaurant ON public.subscription_plan_history(restaurant_id, created_at DESC);

-- 4) Trigger: registra automaticamente no histórico quando plan_id muda
CREATE OR REPLACE FUNCTION public.trg_record_plan_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO subscription_plan_history (restaurant_id, subscription_id, from_plan_id, to_plan_id, from_status, to_status, changed_by)
    VALUES (NEW.restaurant_id, NEW.id, NULL, NEW.plan_id, NULL, NEW.status::text, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND (NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO subscription_plan_history (restaurant_id, subscription_id, from_plan_id, to_plan_id, from_status, to_status, changed_by)
    VALUES (NEW.restaurant_id, NEW.id, OLD.plan_id, NEW.plan_id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscriptions_plan_history
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trg_record_plan_history();

-- >>> MIGRATION: 20260427120429_5e63321c-2ce7-44a1-8ca9-50e8e9ea461c.sql <<<
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON public.orders (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON public.orders (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_driver_status
  ON public.orders (driver_id, status) WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_restaurant_status
  ON public.delivery_drivers (restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_products_restaurant_active
  ON public.products (restaurant_id, active);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_active
  ON public.categories (restaurant_id, active);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant
  ON public.customers (restaurant_id);

-- >>> MIGRATION: 20260427141906_b6e3e0fe-94ad-4cfc-ae24-bba8227a3b08.sql <<<
UPDATE public.subscription_plans SET price = 199.00 WHERE id = 'd9643d6c-59e3-4038-aa96-14ffb28f684f';

-- >>> MIGRATION: 20260427143240_5869c7e5-845b-47d5-9416-1e36cb6d8274.sql <<<
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- >>> MIGRATION: 20260427143548_dfb7fca7-9e2f-4529-b466-927de67491b2.sql <<<
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.driver_confirm_receipt(_driver_id uuid, _pin text, _order_id uuid)
RETURNS TABLE(success boolean, already boolean, accepted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
  _existing timestamptz;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM delivery_drivers d
    JOIN orders o ON o.driver_id = d.id
    WHERE d.id = _driver_id AND d.access_pin = _pin AND o.id = _order_id
  ) INTO _ok;

  IF NOT _ok THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT driver_accepted_at INTO _existing FROM orders WHERE id = _order_id;

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT true, true, _existing;
    RETURN;
  END IF;

  UPDATE orders SET driver_accepted_at = now(), updated_at = now()
  WHERE id = _order_id AND driver_accepted_at IS NULL;

  SELECT driver_accepted_at INTO _existing FROM orders WHERE id = _order_id;
  RETURN QUERY SELECT true, false, _existing;
END;
$$;

-- >>> MIGRATION: 20260427143956_bfa4f195-0157-45d6-89e9-9cb82d01a398.sql <<<
-- Tags em satisfaction_surveys
ALTER TABLE public.satisfaction_surveys 
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

-- Único survey por pedido
CREATE UNIQUE INDEX IF NOT EXISTS satisfaction_surveys_order_unique 
  ON public.satisfaction_surveys(order_id) WHERE order_id IS NOT NULL;

-- Driver ratings
CREATE TABLE IF NOT EXISTS public.driver_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  customer_name text,
  customer_phone text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags text[] DEFAULT '{}'::text[],
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver ON public.driver_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_restaurant ON public.driver_ratings(restaurant_id);

ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

-- Cliente anônimo pode inserir desde que pedido exista, esteja completo e tenha < 7 dias
CREATE POLICY "Public can submit driver rating for recent completed orders"
  ON public.driver_ratings FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = driver_ratings.order_id
        AND o.driver_id = driver_ratings.driver_id
        AND o.restaurant_id = driver_ratings.restaurant_id
        AND o.status = 'completed'
        AND o.created_at > now() - interval '7 days'
    )
  );

-- Equipe do restaurante pode ver
CREATE POLICY "Restaurant staff can view driver ratings"
  ON public.driver_ratings FOR SELECT
  USING (has_restaurant_role(auth.uid(), restaurant_id));

-- Super admin acesso total
CREATE POLICY "Super admins full access driver ratings"
  ON public.driver_ratings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Cliente que fez pedido pode ver a própria avaliação
CREATE POLICY "Customer can view own driver rating"
  ON public.driver_ratings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM orders o JOIN customers c ON c.id = o.customer_id
            WHERE o.id = driver_ratings.order_id AND c.user_id = auth.uid())
  );

-- View de resumo por entregador (security_invoker para respeitar RLS)
CREATE OR REPLACE VIEW public.driver_ratings_summary
WITH (security_invoker = on) AS
SELECT 
  d.id AS driver_id,
  d.restaurant_id,
  d.name,
  COALESCE(AVG(r.rating)::numeric(3,2), 0) AS avg_rating,
  COUNT(r.id)::int AS total_ratings
FROM delivery_drivers d
LEFT JOIN driver_ratings r ON r.driver_id = d.id
GROUP BY d.id, d.restaurant_id, d.name;

-- >>> MIGRATION: 20260427150520_8bc9a7e2-cab7-4fa5-96f0-350bcc3d5901.sql <<<
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

-- >>> MIGRATION: 20260427150602_1800c361-4503-4664-bad5-b61fcf55b096.sql <<<
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- >>> MIGRATION: 20260427150933_742649cd-895a-4a3b-9ca3-93d4705aa01d.sql <<<
CREATE OR REPLACE FUNCTION public.driver_list_history(
  _driver_id uuid,
  _pin text,
  _limit int DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  number int,
  customer_name text,
  address text,
  total numeric,
  delivery_fee numeric,
  payment_method text,
  status order_status,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery_drivers WHERE id = _driver_id AND access_pin = _pin) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT o.id, o.number, o.customer_name, o.address, o.total, o.delivery_fee,
           o.payment_method, o.status, o.dispatched_at, o.delivered_at, o.created_at
    FROM orders o
    WHERE o.driver_id = _driver_id
      AND o.status = 'completed'::order_status
    ORDER BY COALESCE(o.delivered_at, o.updated_at) DESC
    LIMIT GREATEST(_limit, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_earnings_summary(
  _driver_id uuid,
  _pin text
)
RETURNS TABLE(
  total_deliveries bigint,
  total_earnings numeric,
  today_deliveries bigint,
  today_earnings numeric,
  week_deliveries bigint,
  week_earnings numeric,
  month_deliveries bigint,
  month_earnings numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery_drivers WHERE id = _driver_id AND access_pin = _pin) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(o.delivery_fee), 0)::numeric,
    COUNT(*) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('day', now()))::bigint,
    COALESCE(SUM(o.delivery_fee) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('day', now())), 0)::numeric,
    COUNT(*) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('week', now()))::bigint,
    COALESCE(SUM(o.delivery_fee) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('week', now())), 0)::numeric,
    COUNT(*) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('month', now()))::bigint,
    COALESCE(SUM(o.delivery_fee) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('month', now())), 0)::numeric
  FROM orders o
  WHERE o.driver_id = _driver_id
    AND o.status = 'completed'::order_status;
END;
$$;

-- >>> MIGRATION: 20260427151251_f7194ad3-3ca8-4f04-abfa-9b656a5cf2d8.sql <<<
ALTER TABLE public.driver_ratings
  ADD CONSTRAINT driver_ratings_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.delivery_drivers(id) ON DELETE CASCADE;

ALTER TABLE public.driver_ratings
  ADD CONSTRAINT driver_ratings_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.driver_ratings
  ADD CONSTRAINT driver_ratings_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- >>> MIGRATION: 20260428001534_83cb17f5-fb2c-4a8c-886b-fbb704f26b79.sql <<<
CREATE OR REPLACE FUNCTION public.get_table_open_orders(_restaurant_id uuid, _table_id uuid)
RETURNS TABLE(
  id uuid,
  number integer,
  status order_status,
  type order_type,
  subtotal numeric,
  delivery_fee numeric,
  discount numeric,
  total numeric,
  payment_status text,
  payment_method text,
  customer_name text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.number, o.status, o.type, o.subtotal, o.delivery_fee, o.discount, o.total,
    o.payment_status, o.payment_method, o.customer_name, o.notes,
    o.created_at, o.updated_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'name', oi.name,
        'qty', oi.qty,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'options', oi.options,
        'notes', oi.notes
      ) ORDER BY oi.created_at)
      FROM order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb) AS items
  FROM orders o
  WHERE o.restaurant_id = _restaurant_id
    AND o.table_id = _table_id
    AND o.type = 'dine_in'::order_type
    AND o.status <> 'cancelled'::order_status
    AND o.created_at > now() - interval '8 hours'
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_open_orders(uuid, uuid) TO anon, authenticated;

-- >>> MIGRATION: 20260428215848_9e694e2c-7160-48da-85f1-fae8d5757351.sql <<<
-- ============================================================================
-- HARDENING DE SEGURANÇA — Fases A + B
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1. user_roles: bloqueia escalonamento de privilégio
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner can insert user_roles" ON public.user_roles;

-- Só o dono do restaurante (ou super_admin) pode inserir/alterar roles desse restaurante
CREATE POLICY "Restaurant owner manages user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Restaurant owner updates user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Restaurant owner deletes user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- A2. orders / order_items: PII protegida
-- Cliente só pode buscar pedido se souber o ID exato (UUID)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon and authenticated can view recent orders" ON public.orders;
DROP POLICY IF EXISTS "Anon and authenticated can view recent order items" ON public.order_items;

-- RPC segura para acompanhar pedido por ID (já existe lógica similar no front)
CREATE OR REPLACE FUNCTION public.get_order_for_tracking(_order_id uuid)
RETURNS TABLE (
  id uuid,
  number integer,
  status order_status,
  type order_type,
  total numeric,
  subtotal numeric,
  delivery_fee numeric,
  discount numeric,
  payment_method text,
  payment_status text,
  customer_name text,
  customer_phone text,
  address text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  restaurant_id uuid,
  table_id uuid,
  driver_id uuid,
  items jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.number, o.status, o.type, o.total, o.subtotal, o.delivery_fee, o.discount,
    o.payment_method, o.payment_status, o.customer_name, o.customer_phone, o.address, o.notes,
    o.created_at, o.updated_at, o.restaurant_id, o.table_id, o.driver_id,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'name', oi.name, 'qty', oi.qty,
        'unit_price', oi.unit_price, 'total_price', oi.total_price,
        'options', oi.options, 'notes', oi.notes
      ) ORDER BY oi.created_at)
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb) AS items
  FROM public.orders o
  WHERE o.id = _order_id
    AND o.created_at > now() - interval '7 days'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_order_for_tracking(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_for_tracking(uuid) TO anon, authenticated;

-- RPC para buscar pedido por telefone (sem expor toda a tabela)
CREATE OR REPLACE FUNCTION public.find_orders_by_phone(_restaurant_id uuid, _phone text)
RETURNS TABLE (
  id uuid,
  number integer,
  status order_status,
  type order_type,
  total numeric,
  customer_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.number, o.status, o.type, o.total, o.customer_name, o.created_at
  FROM public.orders o
  WHERE o.restaurant_id = _restaurant_id
    AND regexp_replace(COALESCE(o.customer_phone, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND o.created_at > now() - interval '7 days'
  ORDER BY o.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.find_orders_by_phone(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_orders_by_phone(uuid, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- A3. satisfaction_surveys: leitura pública removida
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Anyone can view surveys" ON public.satisfaction_surveys;

-- Mantém INSERT público (cliente envia avaliação) e leitura só para staff
-- Verifica se a policy de staff já existe; se não, cria:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='satisfaction_surveys'
      AND policyname='Restaurant staff can view surveys'
  ) THEN
    CREATE POLICY "Restaurant staff can view surveys"
    ON public.satisfaction_surveys
    FOR SELECT
    TO authenticated
    USING (has_restaurant_role(auth.uid(), restaurant_id));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- A4. Storage restaurant-assets: isolamento por restaurante
-- Paths usados: {restaurantId}/... e banners/{restaurantId}/...
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can upload restaurant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update restaurant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete restaurant assets" ON storage.objects;

CREATE POLICY "Restaurant staff upload own assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'restaurant-assets'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      -- path = "{rest_id}/..." → primeira pasta é o uuid
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
    OR (
      -- path = "banners/{rest_id}/..."
      (storage.foldername(name))[1] = 'banners'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

CREATE POLICY "Restaurant staff update own assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
    OR (
      (storage.foldername(name))[1] = 'banners'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

CREATE POLICY "Restaurant staff delete own assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
    OR (
      (storage.foldername(name))[1] = 'banners'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND has_restaurant_role(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

-- ----------------------------------------------------------------------------
-- A5. restaurants: oculta e-mail/telefone do dono ao público
-- ----------------------------------------------------------------------------
-- Remove leituras públicas existentes que expõem todas as colunas
DROP POLICY IF EXISTS "Anyone can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;

-- View pública somente com campos seguros (sem owner email/phone/whatsapp)
CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = true)
AS
SELECT
  id, name, slug, logo_url, banner_url, address, city, state, zip_code,
  is_open, force_closed, status, created_at
FROM public.restaurants;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- Acesso à tabela completa: dono, staff e super_admin
CREATE POLICY "Owner and staff can view restaurant"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_restaurant_role(auth.uid(), id)
);

-- Acesso público mínimo (slug + dados de vitrine) via tabela ainda é necessário
-- pois muitas telas públicas leem restaurants direto. Permitimos SELECT público
-- mas o aplicativo deve preferir a view. Para não quebrar nada hoje, mantemos
-- leitura pública mas você pode migrar para a view nas próximas sprints.
CREATE POLICY "Public storefront read"
ON public.restaurants
FOR SELECT
TO anon, authenticated
USING (status IN ('active', 'trial'));

-- ----------------------------------------------------------------------------
-- A6. restaurant_settings: oculta telegram_chat_id do público
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view settings" ON public.restaurant_settings;

CREATE OR REPLACE VIEW public.restaurant_settings_public
WITH (security_invoker = true)
AS
SELECT
  id, restaurant_id,
  primary_color, secondary_color,
  opening_hours, payment_methods,
  estimated_prep_time, delivery_fee, min_order_value,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  service_fee_enabled, service_fee_percent,
  couvert_enabled, couvert_value,
  quick_sale_enabled, quick_sale_active_days,
  quick_sale_start_time, quick_sale_end_time,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
FROM public.restaurant_settings;

GRANT SELECT ON public.restaurant_settings_public TO anon, authenticated;

-- Restringe a tabela completa: só staff/dono/super_admin
CREATE POLICY "Staff can view settings"
ON public.restaurant_settings
FOR SELECT
TO authenticated
USING (
  has_restaurant_role(auth.uid(), restaurant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Mantém leitura pública mínima para storefront não quebrar enquanto migramos
-- (sem telegram_chat_id é o ideal, mas hoje várias telas usam SELECT *)
CREATE POLICY "Public storefront settings"
ON public.restaurant_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- NOTA: o ideal é o front trocar SELECT * por restaurant_settings_public.
-- Isto será endereçado em sprint seguinte; a coluna telegram_chat_id
-- continuará exposta até lá (warning, não erro crítico — bot Telegram apenas).

-- ----------------------------------------------------------------------------
-- B1. has_restaurant_role com filtro de papel mínimo
-- ----------------------------------------------------------------------------
-- Hierarquia: owner=4 > manager=3 > attendant=2 > kitchen=1
CREATE OR REPLACE FUNCTION public.has_min_restaurant_role(
  _user_id uuid,
  _restaurant_id uuid,
  _min_role app_role
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH levels AS (
    SELECT 'owner'::app_role AS role, 4 AS lvl
    UNION ALL SELECT 'manager', 3
    UNION ALL SELECT 'attendant', 2
    UNION ALL SELECT 'kitchen', 1
  ),
  needed AS (SELECT lvl FROM levels WHERE role = _min_role)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN levels l ON l.role = ur.role
    WHERE ur.user_id = _user_id
      AND ur.restaurant_id = _restaurant_id
      AND l.lvl >= (SELECT lvl FROM needed)
  );
$$;

REVOKE ALL ON FUNCTION public.has_min_restaurant_role(uuid, uuid, app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_min_restaurant_role(uuid, uuid, app_role) TO authenticated;

-- Aplicar em tabelas sensíveis: financial_transactions, cashier_sessions, expenses
-- (substitui as policies "all staff" por "manager+")

-- financial_transactions
DROP POLICY IF EXISTS "Restaurant staff can insert financial transactions" ON public.financial_transactions;
CREATE POLICY "Manager+ can insert financial"
ON public.financial_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

DROP POLICY IF EXISTS "Restaurant owner can view own financial" ON public.financial_transactions;
CREATE POLICY "Manager+ can view financial"
ON public.financial_transactions
FOR SELECT
TO authenticated
USING (
  has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- expenses: manager+ apenas
DROP POLICY IF EXISTS "Restaurant staff manage expenses" ON public.expenses;
CREATE POLICY "Manager+ manage expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

DROP POLICY IF EXISTS "Restaurant staff manage expense categories" ON public.expense_categories;
CREATE POLICY "Manager+ manage expense categories"
ON public.expense_categories
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

-- cashier_sessions: attendant+ pode (caixa precisa abrir/fechar caixa)
-- mantém has_restaurant_role mas exclui kitchen
DROP POLICY IF EXISTS "Restaurant staff can manage cashier sessions" ON public.cashier_sessions;
CREATE POLICY "Attendant+ manage cashier"
ON public.cashier_sessions
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'attendant'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'attendant'::app_role));

-- ----------------------------------------------------------------------------
-- B3. Tighten anon insert policies — orders/order_items/customers
-- Validar que restaurant_id existe e está ativo (defesa em profundidade)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;

CREATE POLICY "Public can create orders for active restaurants"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id
      AND r.status IN ('active', 'trial')
  )
);

DROP POLICY IF EXISTS "Anon can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can insert order items" ON public.order_items;

CREATE POLICY "Public can insert order items for valid orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > now() - interval '4 hours'
  )
);

DROP POLICY IF EXISTS "Anon can insert customers" ON public.customers;
CREATE POLICY "Public can insert customers for active restaurants"
ON public.customers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = customers.restaurant_id
      AND r.status IN ('active', 'trial')
  )
);

-- ----------------------------------------------------------------------------
-- driver_ratings: evita escrita anônima abusiva (restringe a leitura por ID)
-- A policy de INSERT já verifica que o pedido existe e está completed nos últimos 7d
-- Mantém como está — apenas garante leitura via SECURITY DEFINER já existente
-- ----------------------------------------------------------------------------

-- >>> MIGRATION: 20260428220024_00495157-79b6-4dac-bd13-edae4fda3887.sql <<<
-- Revoga acesso anônimo às colunas sensíveis do dono na tabela restaurants
-- (mantém SELECT em colunas públicas)
REVOKE SELECT ON public.restaurants FROM anon;

GRANT SELECT (
  id, name, slug, logo_url, banner_url, address, city, state, zip_code,
  is_open, force_closed, status, created_at, owner_id
) ON public.restaurants TO anon;

-- Authenticated mantém acesso completo (filtrado por RLS)
-- Garantimos que authenticated também só veja colunas públicas se não for staff/dono
-- mas isso já é tratado pela RLS "Owner and staff can view restaurant" + "Public storefront read"
-- Simplificamos: authenticated vê via RLS (que limita por owner/staff/super_admin),
-- mas o public storefront read deixa anon ver. Fazer column grants a anon resolve.

-- Mesmo tratamento para restaurant_settings: revoga colunas sensíveis de anon
REVOKE SELECT ON public.restaurant_settings FROM anon;

GRANT SELECT (
  id, restaurant_id, primary_color, secondary_color, opening_hours, payment_methods,
  estimated_prep_time, delivery_fee, min_order_value,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  service_fee_enabled, service_fee_percent,
  couvert_enabled, couvert_value,
  quick_sale_enabled, quick_sale_active_days,
  quick_sale_start_time, quick_sale_end_time,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
) ON public.restaurant_settings TO anon;

-- >>> MIGRATION: 20260429222216_3a8546fe-9fb5-47b0-ae16-72a13218069b.sql <<<
GRANT SELECT ON public.restaurants TO anon;

-- >>> MIGRATION: 20260429222708_0fae8641-df58-4da2-ad20-7a6969a81b5b.sql <<<
DROP VIEW IF EXISTS public.restaurants_public;

CREATE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT
  id, name, slug, logo_url, banner_url,
  phone, whatsapp, address, city, state, zip_code,
  status, is_open, force_closed,
  created_at, updated_at
FROM public.restaurants;

DROP POLICY IF EXISTS "Public storefront read" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view suspended restaurants" ON public.restaurants;

CREATE POLICY "Public storefront read safe"
  ON public.restaurants FOR SELECT
  TO anon, authenticated
  USING (status IN ('active','trial','suspended','cancelled','overdue'));

REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, slug, logo_url, banner_url,
  phone, whatsapp, address, city, state, zip_code,
  status, is_open, force_closed, created_at, updated_at
) ON public.restaurants TO anon;

GRANT SELECT ON public.restaurants TO authenticated;
GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- >>> MIGRATION: 20260501014430_087c899d-d543-45e2-a784-695b6a5dce2e.sql <<<
ALTER TABLE public.restaurant_settings REPLICA IDENTITY FULL;
ALTER TABLE public.restaurants REPLICA IDENTITY FULL;
ALTER TABLE public.financial_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_transactions;

-- >>> MIGRATION: 20260501015802_5d461778-d2cd-4463-a9a8-bfd91df80216.sql <<<
-- ========= NIGHTLIFE ACTS (line-up) =========
CREATE TABLE public.nightlife_acts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  artist_name TEXT NOT NULL,
  genre TEXT,
  description TEXT,
  image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nightlife_acts_restaurant_time ON public.nightlife_acts(restaurant_id, starts_at);

ALTER TABLE public.nightlife_acts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active acts"
  ON public.nightlife_acts FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff can manage acts"
  ON public.nightlife_acts FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access acts"
  ON public.nightlife_acts FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_nightlife_acts_updated_at
  BEFORE UPDATE ON public.nightlife_acts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= NIGHTLIFE HOUR DRINKS (drink da hora) =========
CREATE TABLE public.nightlife_hour_drinks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  product_id UUID,
  custom_name TEXT,
  custom_image_url TEXT,
  promo_price NUMERIC NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  highlight_text TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nightlife_drinks_restaurant_time ON public.nightlife_hour_drinks(restaurant_id, starts_at);

ALTER TABLE public.nightlife_hour_drinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active hour drinks"
  ON public.nightlife_hour_drinks FOR SELECT
  USING (active = true);

CREATE POLICY "Restaurant staff can manage hour drinks"
  ON public.nightlife_hour_drinks FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access hour drinks"
  ON public.nightlife_hour_drinks FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_nightlife_hour_drinks_updated_at
  BEFORE UPDATE ON public.nightlife_hour_drinks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= REALTIME =========
ALTER TABLE public.nightlife_acts REPLICA IDENTITY FULL;
ALTER TABLE public.nightlife_hour_drinks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nightlife_acts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nightlife_hour_drinks;

-- >>> MIGRATION: 20260501115951_3dd77f43-9769-4bd9-99f0-40ad7384e246.sql <<<
-- ============ MUSIC REQUESTS (Modo Balada Fase 2) ============

-- Settings: 4 colunas no restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS music_requests_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS music_requests_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS music_requests_window_start time,
  ADD COLUMN IF NOT EXISTS music_requests_window_end time;

-- Tabela de pedidos de música
CREATE TABLE IF NOT EXISTS public.music_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  song_text text NOT NULL,
  dedication text,
  customer_name text,
  customer_phone text,
  table_label text,
  price numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending', -- pending | paid | refunded
  status text NOT NULL DEFAULT 'queued',          -- queued | playing | played | rejected
  played_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_requests_rest_status ON public.music_requests(restaurant_id, status, created_at DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_music_requests_updated_at ON public.music_requests;
CREATE TRIGGER trg_music_requests_updated_at
BEFORE UPDATE ON public.music_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.music_requests ENABLE ROW LEVEL SECURITY;

-- Public pode inserir SE music_requests_enabled=true E (sem janela OU dentro da janela horária local now())
CREATE POLICY "Public can submit music requests when enabled"
ON public.music_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_settings rs
    JOIN public.restaurants r ON r.id = rs.restaurant_id
    WHERE rs.restaurant_id = music_requests.restaurant_id
      AND rs.music_requests_enabled = true
      AND r.status IN ('active'::restaurant_status, 'trial'::restaurant_status)
      AND (
        rs.music_requests_window_start IS NULL
        OR rs.music_requests_window_end IS NULL
        OR (
          CASE
            WHEN rs.music_requests_window_start <= rs.music_requests_window_end
              THEN (now() AT TIME ZONE 'America/Sao_Paulo')::time BETWEEN rs.music_requests_window_start AND rs.music_requests_window_end
            ELSE -- janela cruza meia-noite (ex: 22h–04h)
              (now() AT TIME ZONE 'America/Sao_Paulo')::time >= rs.music_requests_window_start
              OR (now() AT TIME ZONE 'America/Sao_Paulo')::time <= rs.music_requests_window_end
          END
        )
      )
  )
);

-- Restaurant staff (DJ/atendente) gerencia
CREATE POLICY "Restaurant staff manage music requests"
ON public.music_requests
FOR ALL
TO authenticated
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

-- Super admin
CREATE POLICY "Super admins full access music requests"
ON public.music_requests
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Public pode ver a fila atual (sem dados sensíveis — vamos filtrar no client)
CREATE POLICY "Public can view recent music queue"
ON public.music_requests
FOR SELECT
TO anon, authenticated
USING (created_at > now() - interval '6 hours');

-- Realtime
ALTER TABLE public.music_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.music_requests;

-- Trigger Telegram (notificar DJ/staff sobre novo pedido)
CREATE OR REPLACE FUNCTION public.trg_telegram_music_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_telegram_event(
    NEW.restaurant_id,
    'music_request',
    jsonb_build_object(
      'request_id', NEW.id,
      'song', NEW.song_text,
      'dedication', NEW.dedication,
      'customer_name', NEW.customer_name,
      'table_label', NEW.table_label,
      'price', NEW.price,
      'payment_status', NEW.payment_status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_music_request_notify ON public.music_requests;
CREATE TRIGGER trg_music_request_notify
AFTER INSERT ON public.music_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_telegram_music_request();

-- >>> MIGRATION: 20260501120728_65db6a53-a624-4c0b-8eec-e777c110f0fc.sql <<<
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

-- >>> MIGRATION: 20260501121731_c54c7496-4a9c-4997-9d64-53d07322cc13.sql <<<
-- 1. Link column
ALTER TABLE public.music_requests
  ADD COLUMN IF NOT EXISTS order_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_music_requests_order_item ON public.music_requests(order_item_id);

-- 2. Approve helper: links request to the open dine-in tab for the matching table label
CREATE OR REPLACE FUNCTION public.approve_music_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.music_requests%ROWTYPE;
  _table_id uuid;
  _order_id uuid;
  _item_id uuid;
  _table_num int;
BEGIN
  SELECT * INTO _req FROM public.music_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Permission check: must have role on this restaurant or be super admin
  IF NOT (public.has_restaurant_role(auth.uid(), _req.restaurant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Try to resolve table by label / number
  IF _req.table_label IS NOT NULL THEN
    -- Try by label first
    SELECT id INTO _table_id FROM public.restaurant_tables
      WHERE restaurant_id = _req.restaurant_id
        AND (label = _req.table_label OR label ILIKE _req.table_label)
      LIMIT 1;

    -- Fallback: extract number from label like "Mesa 5" or "5"
    IF _table_id IS NULL THEN
      BEGIN
        _table_num := (regexp_replace(_req.table_label, '\D', '', 'g'))::int;
        IF _table_num IS NOT NULL THEN
          SELECT id INTO _table_id FROM public.restaurant_tables
            WHERE restaurant_id = _req.restaurant_id AND number = _table_num
            LIMIT 1;
        END IF;
      EXCEPTION WHEN others THEN
        _table_id := NULL;
      END;
    END IF;
  END IF;

  -- If we have a table and price > 0, find/create open dine-in order and add item
  IF _table_id IS NOT NULL AND _req.price > 0 THEN
    SELECT id INTO _order_id FROM public.orders
      WHERE restaurant_id = _req.restaurant_id
        AND table_id = _table_id
        AND type = 'dine_in'::order_type
        AND status NOT IN ('completed'::order_status, 'cancelled'::order_status)
        AND created_at > now() - interval '12 hours'
      ORDER BY created_at DESC
      LIMIT 1;

    -- If no open tab, create a lightweight one
    IF _order_id IS NULL THEN
      INSERT INTO public.orders (restaurant_id, table_id, type, status, customer_name, subtotal, total, payment_status)
      VALUES (_req.restaurant_id, _table_id, 'dine_in'::order_type, 'new'::order_status,
              COALESCE(_req.customer_name, 'Mesa'), _req.price, _req.price, 'pending')
      RETURNING id INTO _order_id;
    END IF;

    -- Insert music item in the tab
    INSERT INTO public.order_items (order_id, name, qty, unit_price, total_price, notes)
    VALUES (_order_id, '🎵 Pedido de música: ' || _req.song_text, 1, _req.price, _req.price,
            COALESCE('Dedicatória: ' || _req.dedication, 'Pedido de música'))
    RETURNING id INTO _item_id;

    -- Recompute order totals
    UPDATE public.orders
      SET subtotal = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0),
          total = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0) + COALESCE(delivery_fee, 0) - COALESCE(discount, 0),
          updated_at = now()
      WHERE id = _order_id;
  END IF;

  -- Update request
  UPDATE public.music_requests
    SET status = 'queued',
        order_item_id = _item_id,
        payment_status = CASE WHEN _item_id IS NOT NULL THEN 'pending' ELSE payment_status END,
        updated_at = now()
    WHERE id = _request_id;

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'order_id', _order_id,
    'order_item_id', _item_id,
    'linked_to_tab', _item_id IS NOT NULL
  );
END;
$$;

-- 3. Reject helper: removes linked item and refunds
CREATE OR REPLACE FUNCTION public.reject_music_request(_request_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.music_requests%ROWTYPE;
  _order_id uuid;
  _refunded boolean := false;
BEGIN
  SELECT * INTO _req FROM public.music_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT (public.has_restaurant_role(auth.uid(), _req.restaurant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- If linked to a tab item, remove it and recompute order
  IF _req.order_item_id IS NOT NULL THEN
    SELECT order_id INTO _order_id FROM public.order_items WHERE id = _req.order_item_id;

    DELETE FROM public.order_items WHERE id = _req.order_item_id;
    _refunded := true;

    IF _order_id IS NOT NULL THEN
      UPDATE public.orders
        SET subtotal = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0),
            total = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0) + COALESCE(delivery_fee, 0) - COALESCE(discount, 0),
            updated_at = now()
        WHERE id = _order_id;
    END IF;
  END IF;

  UPDATE public.music_requests
    SET status = 'rejected',
        rejected_reason = COALESCE(_reason, 'Não disponível'),
        payment_status = CASE WHEN _refunded OR payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
        order_item_id = NULL,
        updated_at = now()
    WHERE id = _request_id;

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'refunded_from_tab', _refunded,
    'order_id', _order_id
  );
END;
$$;

-- >>> MIGRATION: 20260501121749_817b07ad-9da6-4a76-9bc6-979c96e86ff2.sql <<<
REVOKE EXECUTE ON FUNCTION public.approve_music_request(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_music_request(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_music_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_music_request(uuid, text) TO authenticated;

-- >>> MIGRATION: 20260501124924_737b402d-389f-455e-8c09-82da212c45b3.sql <<<
-- 1) Add billing routing fields to music_requests
ALTER TABLE public.music_requests
  ADD COLUMN IF NOT EXISTS command_id UUID REFERENCES public.table_commands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'table' CHECK (billing_mode IN ('table','command'));

CREATE INDEX IF NOT EXISTS idx_music_requests_command ON public.music_requests(command_id);

-- 2) Public RPC: list open commands for a given table label (for the customer chooser)
CREATE OR REPLACE FUNCTION public.list_open_commands_for_table(
  _restaurant_id uuid,
  _table_label text
)
RETURNS TABLE (
  id uuid,
  customer_name text,
  opened_at timestamptz,
  open_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _table_id uuid;
  _table_num int;
BEGIN
  IF _table_label IS NULL OR length(trim(_table_label)) = 0 THEN
    RETURN;
  END IF;

  -- Resolve table by exact label first, then by extracted number
  SELECT t.id INTO _table_id FROM public.restaurant_tables t
    WHERE t.restaurant_id = _restaurant_id
      AND (t.label = _table_label OR t.label ILIKE _table_label)
    LIMIT 1;

  IF _table_id IS NULL THEN
    BEGIN
      _table_num := (regexp_replace(_table_label, '\D', '', 'g'))::int;
      IF _table_num IS NOT NULL THEN
        SELECT t.id INTO _table_id FROM public.restaurant_tables t
          WHERE t.restaurant_id = _restaurant_id AND t.number = _table_num
          LIMIT 1;
      END IF;
    EXCEPTION WHEN others THEN
      _table_id := NULL;
    END;
  END IF;

  IF _table_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      tc.id,
      tc.customer_name,
      tc.opened_at,
      COALESCE((
        SELECT SUM(oi.total_price)
        FROM public.order_items oi
        WHERE oi.command_id = tc.id
      ), 0)::numeric AS open_total
    FROM public.table_commands tc
    WHERE tc.restaurant_id = _restaurant_id
      AND tc.table_id = _table_id
      AND tc.status = 'open'
    ORDER BY tc.opened_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_open_commands_for_table(uuid, text) TO anon, authenticated;

-- 3) Update approve_music_request to honor billing_mode + command_id
CREATE OR REPLACE FUNCTION public.approve_music_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.music_requests%ROWTYPE;
  _table_id uuid;
  _order_id uuid;
  _item_id uuid;
  _table_num int;
  _item_name text;
  _cmd_customer text;
BEGIN
  SELECT * INTO _req FROM public.music_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT (public.has_restaurant_role(auth.uid(), _req.restaurant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- If billed to a specific command, derive the table from it
  IF _req.billing_mode = 'command' AND _req.command_id IS NOT NULL THEN
    SELECT tc.table_id, tc.customer_name INTO _table_id, _cmd_customer
      FROM public.table_commands tc
      WHERE tc.id = _req.command_id AND tc.restaurant_id = _req.restaurant_id
      LIMIT 1;
  END IF;

  -- Fallback: resolve table from label
  IF _table_id IS NULL AND _req.table_label IS NOT NULL THEN
    SELECT id INTO _table_id FROM public.restaurant_tables
      WHERE restaurant_id = _req.restaurant_id
        AND (label = _req.table_label OR label ILIKE _req.table_label)
      LIMIT 1;

    IF _table_id IS NULL THEN
      BEGIN
        _table_num := (regexp_replace(_req.table_label, '\D', '', 'g'))::int;
        IF _table_num IS NOT NULL THEN
          SELECT id INTO _table_id FROM public.restaurant_tables
            WHERE restaurant_id = _req.restaurant_id AND number = _table_num
            LIMIT 1;
        END IF;
      EXCEPTION WHEN others THEN
        _table_id := NULL;
      END;
    END IF;
  END IF;

  IF _table_id IS NOT NULL AND _req.price > 0 THEN
    -- Find existing open dine-in order for this table
    SELECT id INTO _order_id FROM public.orders
      WHERE restaurant_id = _req.restaurant_id
        AND table_id = _table_id
        AND type = 'dine_in'::order_type
        AND status NOT IN ('completed'::order_status, 'cancelled'::order_status)
      ORDER BY created_at DESC
      LIMIT 1;

    IF _order_id IS NULL THEN
      INSERT INTO public.orders (restaurant_id, table_id, type, status, customer_name, subtotal, total, payment_status)
      VALUES (_req.restaurant_id, _table_id, 'dine_in'::order_type, 'new'::order_status,
              COALESCE(_cmd_customer, _req.customer_name, 'Mesa'), _req.price, _req.price, 'pending')
      RETURNING id INTO _order_id;
    END IF;

    -- Build item label depending on billing mode
    IF _req.billing_mode = 'command' AND _req.command_id IS NOT NULL THEN
      _item_name := '🎵 Música (' || COALESCE(_cmd_customer, 'comanda') || '): ' || _req.song_text;
    ELSE
      _item_name := '🎵 Músicas da mesa: ' || _req.song_text;
    END IF;

    INSERT INTO public.order_items (order_id, command_id, name, qty, unit_price, total_price, notes)
    VALUES (
      _order_id,
      CASE WHEN _req.billing_mode = 'command' THEN _req.command_id ELSE NULL END,
      _item_name,
      1, _req.price, _req.price,
      COALESCE('Dedicatória: ' || _req.dedication, 'Pedido de música')
    )
    RETURNING id INTO _item_id;

    UPDATE public.orders
      SET subtotal = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0),
          total = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0) + COALESCE(delivery_fee, 0) - COALESCE(discount, 0),
          updated_at = now()
      WHERE id = _order_id;
  END IF;

  UPDATE public.music_requests
    SET status = 'queued',
        order_item_id = _item_id,
        payment_status = CASE WHEN _item_id IS NOT NULL THEN 'pending' ELSE payment_status END,
        updated_at = now()
    WHERE id = _request_id;

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'order_id', _order_id,
    'order_item_id', _item_id,
    'linked_to_tab', _item_id IS NOT NULL,
    'billing_mode', _req.billing_mode,
    'command_id', _req.command_id
  );
END;
$$;

-- >>> MIGRATION: 20260501231758_84f45b5e-0ca7-4a3d-b9e1-a95e9779e0b0.sql <<<
-- Popular Boteco do Zé com dados de balada para a demo pública
DO $$
DECLARE
  v_rest uuid := '22222222-0000-0000-0000-000000000001';
  v_product uuid;
BEGIN
  -- 1) Habilitar pedidos de música
  UPDATE public.restaurant_settings
  SET music_requests_enabled = true,
      music_requests_price = 10,
      music_requests_window_start = '20:00',
      music_requests_window_end = '04:00'
  WHERE restaurant_id = v_rest;

  -- 2) Limpar atrações antigas e inserir line-up para hoje (24/7 demo)
  DELETE FROM public.nightlife_acts WHERE restaurant_id = v_rest;
  INSERT INTO public.nightlife_acts (restaurant_id, artist_name, genre, description, starts_at, ends_at, sort_order, active) VALUES
    (v_rest, 'DJ Lê Costa', 'Sunset / Lounge',         'Aquecimento da noite',           date_trunc('day', now()) + interval '20 hours', date_trunc('day', now()) + interval '22 hours', 1, true),
    (v_rest, 'Banda Pé na Estrada', 'Sertanejo Raiz', 'Show ao vivo',                    date_trunc('day', now()) + interval '22 hours', date_trunc('day', now()) + interval '26 hours', 2, true),
    (v_rest, 'DJ Marcão', 'Sertanejo Universitário',   'Esquenta da pista',               date_trunc('day', now()) + interval '26 hours', date_trunc('day', now()) + interval '28 hours', 3, true),
    (v_rest, 'After Set — DJ Bia', 'House Remix',      'O fim que ninguém quer ver vir',  date_trunc('day', now()) + interval '28 hours', date_trunc('day', now()) + interval '30 hours', 4, true);

  -- 3) Hour drink ativo agora (2 horas), pega um produto qualquer do bar
  SELECT id INTO v_product FROM public.products WHERE restaurant_id = v_rest AND active = true ORDER BY created_at LIMIT 1;
  DELETE FROM public.nightlife_hour_drinks WHERE restaurant_id = v_rest;
  IF v_product IS NOT NULL THEN
    INSERT INTO public.nightlife_hour_drinks (restaurant_id, product_id, custom_name, promo_price, highlight_text, starts_at, ends_at, active) VALUES
      (v_rest, v_product, 'Caipirinha de Maracujá', 9, 'Metade do preço — só essa hora!', now() - interval '15 minutes', now() + interval '1 hour 45 minutes', true),
      (v_rest, v_product, 'Chopp Pilsen 600ml',     8, 'Geladíssimo, colarinho perfeito', now() + interval '2 hours',    now() + interval '4 hours',  true);
  END IF;
END $$;

-- >>> MIGRATION: 20260502114543_e390cb98-a338-4fad-955a-a5cc954332da.sql <<<
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

-- >>> MIGRATION: 20260502115746_0cfb4bf3-b007-4ca6-99e3-4e4fca9d5356.sql <<<
-- Programa de Indicação (Afiliados)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  uses_count INTEGER NOT NULL DEFAULT 0,
  conversions_count INTEGER NOT NULL DEFAULT 0,
  total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_restaurant ON public.referral_codes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);

CREATE TABLE IF NOT EXISTS public.referral_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referred_restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | paid | cancelled
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_conv_code ON public.referral_conversions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_conv_referred ON public.referral_conversions(referred_restaurant_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_conversions ENABLE ROW LEVEL SECURITY;

-- RLS: dono vê só os próprios códigos
CREATE POLICY "owner reads own referral codes"
  ON public.referral_codes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.restaurant_id = referral_codes.restaurant_id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "owner inserts own referral codes"
  ON public.referral_codes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.restaurant_id = referral_codes.restaurant_id
              AND ur.role IN ('owner','manager'))
  );

CREATE POLICY "super_admin manages referral codes"
  ON public.referral_codes FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "owner reads own conversions"
  ON public.referral_conversions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.referral_codes rc
            JOIN public.user_roles ur ON ur.restaurant_id = rc.restaurant_id
            WHERE rc.id = referral_conversions.referral_code_id
              AND ur.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "super_admin manages conversions"
  ON public.referral_conversions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Permitir leitura pública (anon) por código para validação no cadastro
CREATE POLICY "public can validate referral code"
  ON public.referral_codes FOR SELECT
  TO anon
  USING (active = true);

-- ============= STATUS PAGE (Incidentes) =============
CREATE TABLE IF NOT EXISTS public.status_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'minor', -- minor | major | critical
  status TEXT NOT NULL DEFAULT 'investigating', -- investigating | identified | monitoring | resolved
  component TEXT, -- api | dashboard | menu | telegram | mp | etc
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON public.status_incidents(started_at DESC);

ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read incidents"
  ON public.status_incidents FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "super_admin manages incidents"
  ON public.status_incidents FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============= ONBOARDING PROGRESS (tour) =============
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tour_completed BOOLEAN NOT NULL DEFAULT false,
  steps_done JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own onboarding"
  ON public.onboarding_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user upserts own onboarding"
  ON public.onboarding_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user updates own onboarding"
  ON public.onboarding_progress FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "super_admin reads all onboarding"
  ON public.onboarding_progress FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_onboarding_updated
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- >>> MIGRATION: 20260502165710_e7412d08-cc32-444d-9603-1779294e530e.sql <<<
CREATE OR REPLACE FUNCTION public.can_insert_recent_public_order_item(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = _order_id
      AND o.created_at > now() - interval '4 hours'
      AND r.status IN ('active', 'trial')
  );
$$;

DROP POLICY IF EXISTS "Public can insert order items for valid orders" ON public.order_items;

CREATE POLICY "Public can insert order items for recent public orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (public.can_insert_recent_public_order_item(order_id));

-- >>> MIGRATION: 20260502173451_bfcc6e25-84ac-4aef-b065-7cfc6d45a543.sql <<<
GRANT SELECT ON public.restaurant_settings TO anon, authenticated;

-- >>> MIGRATION: 20260502204605_50d7978b-a9b1-4da8-9547-4009b4981053.sql <<<
-- =========================================
-- 1. Tabela push_subscriptions
-- =========================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_restaurant ON public.push_subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions select"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own push subscriptions insert"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own push subscriptions update"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own push subscriptions delete"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================================
-- 2. Função notify_push_event (similar ao notify_telegram_event)
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_push_event(
  _restaurant_id UUID,
  _event_type TEXT,
  _payload JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _url TEXT;
  _anon_key TEXT;
BEGIN
  SELECT value INTO _url FROM platform_settings WHERE key = 'send_push_url';
  SELECT value INTO _anon_key FROM platform_settings WHERE key = 'send_push_anon_key';

  IF _url IS NULL OR _anon_key IS NULL THEN
    RETURN; -- not configured yet
  END IF;

  -- only fire if there is at least one subscription for this restaurant
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE restaurant_id = _restaurant_id) THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'restaurant_id', _restaurant_id,
      'event_type', _event_type,
      'payload', _payload
    )
  );
END;
$$;

-- =========================================
-- 3. Triggers para os 3 eventos
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_push_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM notify_push_event(
    NEW.restaurant_id,
    'new_order',
    jsonb_build_object(
      'order_id', NEW.id,
      'number', NEW.number,
      'customer_name', NEW.customer_name,
      'type', NEW.type,
      'total', NEW.total
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_new_order ON public.orders;
CREATE TRIGGER push_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_new_order();

CREATE OR REPLACE FUNCTION public.trg_push_waiter_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _table_label TEXT;
  _table_number INT;
BEGIN
  SELECT label, number INTO _table_label, _table_number
  FROM restaurant_tables WHERE id = NEW.table_id;

  PERFORM notify_push_event(
    NEW.restaurant_id,
    'waiter_call',
    jsonb_build_object(
      'call_id', NEW.id,
      'type', NEW.type,
      'table_label', COALESCE(_table_label, 'Mesa ' || _table_number),
      'table_number', _table_number,
      'message', NEW.message
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_waiter_call ON public.waiter_calls;
CREATE TRIGGER push_waiter_call
  AFTER INSERT ON public.waiter_calls
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_waiter_call();

CREATE OR REPLACE FUNCTION public.trg_push_music_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when needs approval (status = pending_approval after the existing trigger)
  IF NEW.status = 'pending_approval' THEN
    PERFORM notify_push_event(
      NEW.restaurant_id,
      'music_request',
      jsonb_build_object(
        'request_id', NEW.id,
        'song', NEW.song_text,
        'customer_name', NEW.customer_name,
        'table_label', NEW.table_label,
        'price', NEW.price
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_music_pending ON public.music_requests;
CREATE TRIGGER push_music_pending
  AFTER INSERT ON public.music_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_music_pending();

-- >>> MIGRATION: 20260502220402_ed89c271-dea1-4bd8-994b-aea0ddde051f.sql <<<
-- Save master-notify URL in platform_settings
INSERT INTO platform_settings (key, value)
VALUES ('master_notify_url', '"https://ynxrtjvyeymbiifehenk.supabase.co/functions/v1/master-notify"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Helper function to invoke master-notify
CREATE OR REPLACE FUNCTION public.notify_master_event(_event_type text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _anon_key text;
  _master_chat text;
BEGIN
  SELECT value::text INTO _master_chat FROM platform_settings WHERE key = 'master_telegram_chat_id';
  IF _master_chat IS NULL THEN RETURN; END IF;

  SELECT value::text INTO _url FROM platform_settings WHERE key = 'master_notify_url';
  SELECT value::text INTO _anon_key FROM platform_settings WHERE key = 'telegram_notify_anon_key';
  IF _url IS NULL OR _anon_key IS NULL THEN RETURN; END IF;

  -- strip jsonb quotes
  _url := trim(both '"' from _url);
  _anon_key := trim(both '"' from _anon_key);

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object('event_type', _event_type, 'payload', _payload)
  );
END;
$$;

-- Trigger: new restaurant
CREATE OR REPLACE FUNCTION public.trg_master_new_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      'owner_email', NEW.owner_email,
      'plan', NEW.status,
      'total_active', _total_active
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS master_new_restaurant ON restaurants;
CREATE TRIGGER master_new_restaurant
AFTER INSERT ON restaurants
FOR EACH ROW
EXECUTE FUNCTION trg_master_new_restaurant();

-- Trigger: subscription cancelled
CREATE OR REPLACE FUNCTION public.trg_master_subscription_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant_name text;
  _plan_name text;
  _plan_price numeric;
  _was_active text;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    SELECT name INTO _restaurant_name FROM restaurants WHERE id = NEW.restaurant_id;
    SELECT name, price INTO _plan_name, _plan_price FROM subscription_plans WHERE id = NEW.plan_id;
    _was_active := EXTRACT(DAY FROM (now() - NEW.created_at))::text || ' dias';

    PERFORM notify_master_event(
      'subscription_cancelled',
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'restaurant_name', _restaurant_name,
        'plan', _plan_name,
        'mrr_lost', _plan_price,
        'was_active_for', _was_active
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS master_subscription_cancelled ON subscriptions;
CREATE TRIGGER master_subscription_cancelled
AFTER UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION trg_master_subscription_cancelled();

-- >>> MIGRATION: 20260502220428_5ac10fa8-5303-4cfa-95db-30111a0f2f1d.sql <<<
REVOKE EXECUTE ON FUNCTION public.notify_master_event(text, jsonb) FROM PUBLIC, anon, authenticated;

-- >>> MIGRATION: 20260502231456_afcedb3c-2e92-4c9a-9287-f1463589f85a.sql <<<
UPDATE public.subscriptions SET current_period_end = now() + interval '30 days', status = 'active', updated_at = now() WHERE restaurant_id = 'c438a4c2-3126-4184-b397-114dcbe2c2ad';

-- >>> MIGRATION: 20260502232144_3375eb74-c470-46db-bff6-47aea8c6221e.sql <<<
CREATE POLICY "Restaurant staff can view subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.has_restaurant_role(auth.uid(), restaurant_id));

-- >>> MIGRATION: 20260503001438_911f5d31-a8e6-4ff5-88af-7f6e79243de0.sql <<<
-- Tabela de pulseiras/fichas para Modo Balada
CREATE TABLE public.nightlife_wristbands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active | closed | lost
  tier text NOT NULL DEFAULT 'standard', -- standard | vip
  credit_limit numeric NOT NULL DEFAULT 0, -- 0 = sem limite
  total_consumed numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  customer_name text,
  customer_phone text,
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  issued_by uuid,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);

CREATE INDEX idx_wristbands_restaurant_status ON public.nightlife_wristbands(restaurant_id, status);
CREATE INDEX idx_wristbands_code ON public.nightlife_wristbands(restaurant_id, code);

ALTER TABLE public.nightlife_wristbands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage wristbands"
  ON public.nightlife_wristbands FOR ALL TO authenticated
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access wristbands"
  ON public.nightlife_wristbands FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_wristbands_updated_at
  BEFORE UPDATE ON public.nightlife_wristbands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular pedidos a pulseiras
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wristband_id uuid,
  ADD COLUMN IF NOT EXISTS wristband_code text,
  ADD COLUMN IF NOT EXISTS bar_status text, -- null | pending | preparing | ready | delivered
  ADD COLUMN IF NOT EXISTS bar_pickup_code text,
  ADD COLUMN IF NOT EXISTS bar_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS bar_delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_bar_status ON public.orders(restaurant_id, bar_status) WHERE bar_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_wristband ON public.orders(wristband_id) WHERE wristband_id IS NOT NULL;

-- Trigger: ao criar pedido com wristband, soma consumo; ao mudar payment_status, soma pagamento
CREATE OR REPLACE FUNCTION public.update_wristband_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.wristband_id IS NOT NULL THEN
    UPDATE public.nightlife_wristbands
      SET total_consumed = total_consumed + COALESCE(NEW.total, 0),
          total_paid = total_paid + CASE WHEN NEW.payment_status = 'paid' THEN COALESCE(NEW.total,0) ELSE 0 END
      WHERE id = NEW.wristband_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.wristband_id IS NOT NULL THEN
    -- Se status pagamento mudou para paid
    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status) AND NEW.payment_status = 'paid' THEN
      UPDATE public.nightlife_wristbands
        SET total_paid = total_paid + COALESCE(NEW.total,0)
        WHERE id = NEW.wristband_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_update_wristband ON public.orders;
CREATE TRIGGER trg_orders_update_wristband
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_wristband_totals();

-- Realtime para painel do bar
ALTER PUBLICATION supabase_realtime ADD TABLE public.nightlife_wristbands;

-- >>> MIGRATION: 20260503002953_cfb44f00-b1d3-44e3-90b9-2c1ec45ee2c7.sql <<<
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

-- >>> MIGRATION: 20260621143724_6d0db806-69a2-448f-a98a-37fed6e0c260.sql <<<
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox';

DROP INDEX IF EXISTS idx_subscriptions_mp_preapproval;
ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS mp_preapproval_id,
  DROP COLUMN IF EXISTS mp_init_point;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_lookup_key text UNIQUE;

UPDATE public.subscription_plans SET stripe_lookup_key = 'plan_basico_monthly' WHERE tier = 'basic' AND name = 'Básico';
UPDATE public.subscription_plans SET stripe_lookup_key = 'plan_profissional_monthly' WHERE tier = 'professional';
UPDATE public.subscription_plans SET stripe_lookup_key = 'plan_premium_monthly' WHERE tier = 'premium';
UPDATE public.subscription_plans SET stripe_lookup_key = 'plan_teste_monthly' WHERE name = '🧪 Teste R$ 10';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mp-reconcile-daily') THEN
    PERFORM cron.unschedule('mp-reconcile-daily');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(
  rest_id uuid,
  check_env text DEFAULT 'live'
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE restaurant_id = rest_id
      AND environment = check_env
      AND (
        (status::text IN ('active','trialing','past_due','trial') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status::text IN ('canceled','cancelled') AND current_period_end > now())
      )
  );
$$;

-- >>> MIGRATION: 20260621143917_309f9dc7-eca1-4d2a-83a8-5c423164892f.sql <<<
-- All subscription_status enum values already included in initial definition
-- (Skipping ALTER TYPE to avoid PostgreSQL 55P04 error in single transaction)

-- >>> MIGRATION: 20260625123823_f9c118e9-2ac4-4ace-a38e-0815d690f73b.sql <<<
ALTER TABLE public.subscription_payments
  DROP COLUMN IF EXISTS mp_payment_id,
  DROP COLUMN IF EXISTS mp_preapproval_id,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- >>> MIGRATION: 20260625133259_8bcf270a-5c5f-4b5f-b9d3-d61e4a7243aa.sql <<<
-- ============================================================
-- 1. Helper: SECURITY DEFINER check for active restaurant (for anon RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_restaurant_orderable(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _id AND status IN ('active'::restaurant_status, 'trial'::restaurant_status)
  );
$$;

-- ============================================================
-- 2. restaurants: drop dead public storefront policy (anon has no table grant; safe to remove)
-- ============================================================
DROP POLICY IF EXISTS "Public storefront read safe" ON public.restaurants;

-- ============================================================
-- 3. music_requests: restrict anon column access + tighten policy
-- ============================================================
REVOKE SELECT ON public.music_requests FROM anon;
GRANT SELECT (id, restaurant_id, song_text, status, created_at, played_at, table_label, price, payment_status, dedication) ON public.music_requests TO anon;

DROP POLICY IF EXISTS "Public can view recent music queue" ON public.music_requests;
CREATE POLICY "Public can view recent music queue" ON public.music_requests
  FOR SELECT TO anon, authenticated
  USING (
    created_at > now() - interval '6 hours'
    AND status IN ('queued', 'playing', 'pending_approval')
  );

-- ============================================================
-- 4. platform_settings: lock down to super_admin only
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read platform_settings" ON public.platform_settings;
REVOKE SELECT ON public.platform_settings FROM anon;

-- ============================================================
-- 5. referral_codes: anon can only see code + active
-- ============================================================
REVOKE SELECT ON public.referral_codes FROM anon;
GRANT SELECT (id, code, active, restaurant_id) ON public.referral_codes TO anon;

-- ============================================================
-- 6. restaurant_settings: anon limited to display-safe columns
-- ============================================================
REVOKE SELECT ON public.restaurant_settings FROM anon;
GRANT SELECT (
  id, restaurant_id,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  min_order_value, estimated_prep_time, delivery_fee,
  payment_methods, opening_hours,
  primary_color, secondary_color,
  couvert_enabled, couvert_value,
  service_fee_enabled, service_fee_percent,
  music_requests_enabled, music_requests_price,
  music_requests_window_start, music_requests_window_end, music_requests_require_approval,
  quick_sale_enabled, quick_sale_auto_schedule,
  quick_sale_start_time, quick_sale_end_time, quick_sale_active_days,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
) ON public.restaurant_settings TO anon;

-- ============================================================
-- 7. Replace always-true INSERT/UPDATE policies
-- ============================================================
DROP POLICY IF EXISTS "Anon can create waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon can create waiter calls" ON public.waiter_calls
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can insert table sessions" ON public.table_sessions;
CREATE POLICY "Anon can insert table sessions" ON public.table_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can update table sessions" ON public.table_sessions;
CREATE POLICY "Anon can update table sessions" ON public.table_sessions
  FOR UPDATE TO anon, authenticated
  USING (last_seen_at > now() - interval '4 hours' AND public.is_restaurant_orderable(restaurant_id))
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can insert commands" ON public.table_commands;
CREATE POLICY "Anon can insert commands" ON public.table_commands
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can create reservations" ON public.table_reservations;
CREATE POLICY "Anon can create reservations" ON public.table_reservations
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

DROP POLICY IF EXISTS "Anon can submit surveys" ON public.satisfaction_surveys;
CREATE POLICY "Anon can submit surveys" ON public.satisfaction_surveys
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

-- ============================================================
-- 8. SECURITY DEFINER functions: revoke broad EXECUTE, re-grant intended RPCs
-- ============================================================
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      rec.proname, rec.args
    );
  END LOOP;
END $$;

-- RLS helpers (must be callable by anon/authenticated for policy evaluation)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_restaurant_role(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_min_restaurant_role(uuid, uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_insert_recent_public_order_item(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_restaurant_orderable(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_drink_category_name(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unaccent_simple(text) TO anon, authenticated;

-- Public RPCs: customer-facing tracking & driver app (auth via parameter PIN / order id)
GRANT EXECUTE ON FUNCTION public.driver_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_heartbeat(uuid, text, double precision, double precision, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_mark_delivered(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_confirm_receipt(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_list_assigned_orders(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_list_history(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_earnings_summary(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_orders_by_phone(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_for_tracking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_rating_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_driver_location(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_open_orders(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_commands_for_table(uuid, text) TO anon, authenticated;

-- Staff-only RPCs
GRANT EXECUTE ON FUNCTION public.approve_music_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_music_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_driver_pin(uuid) TO authenticated;

-- Trigger functions and internal helpers (notify_*, trg_*, handle_new_user, update_updated_at_column, set_*, deduct_stock_on_order, auto_skip_kitchen_for_drinks, update_wristband_totals)
-- remain with EXECUTE revoked from anon/authenticated/PUBLIC; service_role and triggers still work.

-- ============================================================
-- 9. Storage bucket: drop broad anon list policy
-- ============================================================
DROP POLICY IF EXISTS "Public can view restaurant assets" ON storage.objects;

-- >>> MIGRATION: 20260625134157_6105a932-79c7-48d2-83d0-9b785a41ced8.sql <<<
-- 1) orders: use helper instead of inline join to restaurants
DROP POLICY IF EXISTS "Public can create orders for active restaurants" ON public.orders;
CREATE POLICY "Public can create orders for active restaurants"
  ON public.orders FOR INSERT
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

-- 2) customers: same
DROP POLICY IF EXISTS "Public can insert customers for active restaurants" ON public.customers;
CREATE POLICY "Public can insert customers for active restaurants"
  ON public.customers FOR INSERT
  WITH CHECK (public.is_restaurant_orderable(restaurant_id));

-- 3) audit_logs: bind user_id to auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 4) notifications: bind user_id to auth.uid() for inserts (triggers run SECURITY DEFINER/service_role and bypass RLS)
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5) coupons: scope public SELECT to active/trial restaurants and require restaurant_id filter
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
CREATE POLICY "Public can view active coupons of orderable restaurants"
  ON public.coupons FOR SELECT
  USING (active = true AND public.is_restaurant_orderable(restaurant_id));

-- 6) referral_codes: drop broad public SELECT, expose validation via RPC instead
DROP POLICY IF EXISTS "public can validate referral code" ON public.referral_codes;

CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS TABLE(id uuid, code text, restaurant_id uuid, active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.id, rc.code, rc.restaurant_id, rc.active
  FROM public.referral_codes rc
  WHERE rc.active = true
    AND rc.code = _code
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

-- 7) table_commands: scope public SELECT to orderable restaurants and recent rows only
DROP POLICY IF EXISTS "Anon can view recent commands" ON public.table_commands;
CREATE POLICY "Anon can view recent commands of orderable restaurants"
  ON public.table_commands FOR SELECT
  USING (
    opened_at > (now() - interval '4 hours')
    AND public.is_restaurant_orderable(restaurant_id)
  );

-- 8) table_sessions: same
DROP POLICY IF EXISTS "Anyone can view recent table sessions" ON public.table_sessions;
CREATE POLICY "Anon can view recent table sessions of orderable restaurants"
  ON public.table_sessions FOR SELECT
  USING (
    last_seen_at > (now() - interval '4 hours')
    AND public.is_restaurant_orderable(restaurant_id)
  );

-- 9) waiter_calls: same
DROP POLICY IF EXISTS "Anon and authenticated can view recent waiter calls" ON public.waiter_calls;
CREATE POLICY "Anon can view recent waiter calls of orderable restaurants"
  ON public.waiter_calls FOR SELECT
  USING (
    created_at > (now() - interval '4 hours')
    AND public.is_restaurant_orderable(restaurant_id)
  );

-- >>> MIGRATION: 20260625163850_9ac7ad0f-6e41-41b9-9e4d-aa42d2926219.sql <<<
DROP POLICY IF EXISTS "User can assign own owner role" ON public.user_roles;

-- >>> MIGRATION: 20260629131336_56fc3449-cd80-4b49-b66e-26369a7cc60b.sql <<<
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

-- >>> MIGRATION: 20260629131941_ebfb85ce-648b-4a77-9e66-88a37fb40485.sql <<<
-- 1) user_roles
DROP POLICY IF EXISTS "Restaurant owner manages user_roles" ON public.user_roles;
CREATE POLICY "Restaurant owner manages user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    role <> 'super_admin'::app_role
    AND restaurant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Restaurant owner updates user_roles" ON public.user_roles;
CREATE POLICY "Restaurant owner updates user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    role <> 'super_admin'::app_role
    AND restaurant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = user_roles.restaurant_id AND r.owner_id = auth.uid())
  )
);

-- 2) music_requests
DROP POLICY IF EXISTS "Public can submit music requests when enabled" ON public.music_requests;
CREATE POLICY "Public can submit music requests when enabled"
ON public.music_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_restaurant_orderable(restaurant_id)
  AND EXISTS (
    SELECT 1 FROM public.restaurant_settings rs
    WHERE rs.restaurant_id = music_requests.restaurant_id
      AND rs.music_requests_enabled = true
      AND (
        rs.music_requests_window_start IS NULL
        OR rs.music_requests_window_end IS NULL
        OR CASE
             WHEN rs.music_requests_window_start <= rs.music_requests_window_end THEN
               ((now() AT TIME ZONE 'America/Sao_Paulo')::time >= rs.music_requests_window_start)
               AND ((now() AT TIME ZONE 'America/Sao_Paulo')::time <= rs.music_requests_window_end)
             ELSE
               ((now() AT TIME ZONE 'America/Sao_Paulo')::time >= rs.music_requests_window_start)
               OR ((now() AT TIME ZONE 'America/Sao_Paulo')::time <= rs.music_requests_window_end)
           END
      )
  )
);

-- 3) delivery_drivers: PIN apenas para gerente+
REVOKE SELECT ON public.delivery_drivers FROM authenticated;
GRANT SELECT (id, restaurant_id, name, phone, vehicle, status, last_lat, last_lng, last_location_at, created_at, updated_at)
  ON public.delivery_drivers TO authenticated;

DROP POLICY IF EXISTS "Restaurant staff can manage drivers" ON public.delivery_drivers;
CREATE POLICY "Restaurant staff read drivers"
ON public.delivery_drivers
FOR SELECT
TO authenticated
USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant managers manage drivers"
ON public.delivery_drivers
FOR ALL
TO authenticated
USING (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role))
WITH CHECK (has_min_restaurant_role(auth.uid(), restaurant_id, 'manager'::app_role));

-- 4) restaurant_settings
DROP POLICY IF EXISTS "Public storefront settings" ON public.restaurant_settings;
CREATE POLICY "Public storefront settings"
ON public.restaurant_settings
FOR SELECT
TO anon, authenticated
USING (public.is_restaurant_orderable(restaurant_id));

REVOKE SELECT ON public.restaurant_settings FROM anon;
GRANT SELECT (
  id,
  restaurant_id,
  delivery_enabled, pickup_enabled, dine_in_enabled,
  min_order_value, estimated_prep_time, delivery_fee,
  payment_methods, opening_hours, primary_color, secondary_color,
  couvert_enabled, couvert_value,
  service_fee_enabled, service_fee_percent,
  music_requests_enabled, music_requests_price,
  music_requests_window_start, music_requests_window_end, music_requests_require_approval,
  quick_sale_enabled, quick_sale_auto_schedule,
  quick_sale_start_time, quick_sale_end_time, quick_sale_active_days,
  quick_sale_welcome_message, quick_sale_thankyou_message,
  created_at, updated_at
) ON public.restaurant_settings TO anon;

-- >>> MIGRATION: 20260706163419_472619e4-2b58-43ab-8e64-7671e3092d6c.sql <<<
-- Restore anon read access to active/trial restaurants via restaurants_public view.
-- The view has security_invoker=on and only exposes public storefront columns
-- (no owner_id, no email, no billing fields), so this is safe.

GRANT SELECT ON public.restaurants TO anon;

CREATE POLICY "Public can view active restaurants"
ON public.restaurants
FOR SELECT
TO anon
USING (status IN ('active'::restaurant_status, 'trial'::restaurant_status));

-- >>> MIGRATION: 20260706164150_26e1c478-235a-464c-9947-277207c24314.sql <<<
CREATE OR REPLACE FUNCTION public.restaurant_has_reservations(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.restaurant_id = _restaurant_id
      AND s.status IN ('active','trial','trialing','past_due')
      AND p.tier IN ('professional','premium')
  );
$$;

GRANT EXECUTE ON FUNCTION public.restaurant_has_reservations(uuid) TO anon, authenticated;

-- >>> MIGRATION: 20260813134519_e8619097-b4ac-41b8-905e-a2640f4d0e96.sql <<<
UPDATE public.subscription_plans 
SET price = 69.99 
WHERE tier = 'basic';

UPDATE public.subscription_plans 
SET price = 119.99 
WHERE tier = 'professional';

UPDATE public.subscription_plans 
SET price = 199.99 
WHERE tier = 'premium';

-- >>> MIGRATION: 20261011185000_price_validation_and_tamper_protection.sql <<<
CREATE OR REPLACE FUNCTION public.validate_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _catalog_price numeric;
  _opts_total numeric := 0;
  _opt_elem jsonb;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT price INTO _catalog_price
    FROM public.products
    WHERE id = NEW.product_id;

    IF _catalog_price IS NOT NULL AND _catalog_price > 0 THEN
      IF NEW.unit_price IS NULL OR NEW.unit_price < _catalog_price THEN
        NEW.unit_price := _catalog_price;
      END IF;
    END IF;
  END IF;

  IF NEW.options IS NOT NULL AND jsonb_typeof(to_jsonb(NEW.options)) = 'array' THEN
    FOR _opt_elem IN SELECT * FROM jsonb_array_elements(to_jsonb(NEW.options)) LOOP
      _opts_total := _opts_total + COALESCE((_opt_elem->>'price')::numeric, 0);
    END LOOP;
  END IF;

  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN
    NEW.qty := 1;
  END IF;

  IF NEW.total_price IS NULL OR NEW.total_price < ((COALESCE(NEW.unit_price, 0) + _opts_total) * NEW.qty) THEN
    NEW.total_price := (COALESCE(NEW.unit_price, 0) + _opts_total) * NEW.qty;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item_price ON public.order_items;
CREATE TRIGGER trg_validate_order_item_price
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_item_price();

CREATE OR REPLACE FUNCTION public.recalculate_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_order_id uuid;
  _items_subtotal numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _target_order_id := OLD.order_id;
  ELSE
    _target_order_id := NEW.order_id;
  END IF;

  SELECT COALESCE(SUM(total_price), 0)
  INTO _items_subtotal
  FROM public.order_items
  WHERE order_id = _target_order_id;

  IF _items_subtotal > 0 THEN
    UPDATE public.orders
    SET subtotal = _items_subtotal,
        total = GREATEST(0, _items_subtotal + COALESCE(delivery_fee, 0) - COALESCE(discount, 0)),
        updated_at = now()
    WHERE id = _target_order_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_order_totals ON public.order_items;
CREATE TRIGGER trg_recalculate_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_order_totals();

