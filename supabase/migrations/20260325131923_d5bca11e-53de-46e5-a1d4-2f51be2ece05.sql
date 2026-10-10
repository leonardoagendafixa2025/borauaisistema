
-- =============================================
-- MENUFOOD SaaS - Multi-Tenant Database Schema
-- =============================================

-- 1. ENUM TYPES
CREATE TYPE public.app_role AS ENUM ('super_admin', 'finance', 'support', 'commercial', 'owner', 'manager', 'attendant', 'kitchen');
CREATE TYPE public.restaurant_status AS ENUM ('active', 'trial', 'overdue', 'suspended', 'cancelled');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'overdue', 'suspended', 'cancelled');
CREATE TYPE public.order_status AS ENUM ('new', 'accepted', 'preparing', 'ready', 'delivering', 'waiting_pickup', 'completed', 'cancelled');
CREATE TYPE public.order_type AS ENUM ('delivery', 'pickup', 'dine_in');
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
