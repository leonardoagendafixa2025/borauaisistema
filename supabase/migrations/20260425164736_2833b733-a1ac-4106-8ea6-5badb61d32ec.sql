
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
