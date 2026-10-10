
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
