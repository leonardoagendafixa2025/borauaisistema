
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
