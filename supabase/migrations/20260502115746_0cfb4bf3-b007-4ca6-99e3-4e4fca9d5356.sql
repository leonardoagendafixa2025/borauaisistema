
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
