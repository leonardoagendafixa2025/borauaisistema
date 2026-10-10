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