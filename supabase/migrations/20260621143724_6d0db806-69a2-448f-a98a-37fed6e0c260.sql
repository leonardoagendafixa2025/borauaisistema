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