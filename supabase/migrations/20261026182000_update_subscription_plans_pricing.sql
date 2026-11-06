-- Atualização dos valores oficiais dos planos de assinatura Bora Uai
-- Básico: R$ 49,99/mês
-- Profissional: R$ 89,99/mês
-- Premium: R$ 149,99/mês

UPDATE public.subscription_plans 
SET price = 49.99 
WHERE tier = 'basic';

UPDATE public.subscription_plans 
SET price = 89.99 
WHERE tier = 'professional';

UPDATE public.subscription_plans 
SET price = 149.99 
WHERE tier = 'premium';

-- Atualiza também stripe_lookup_key para garantir correspondência exata
UPDATE public.subscription_plans SET stripe_lookup_key = 'plan_basico_monthly' WHERE tier = 'basic' AND name = 'Básico';
UPDATE public.subscription_plans SET stripe_lookup_key = 'plan_profissional_monthly' WHERE tier = 'professional';
UPDATE public.subscription_plans SET stripe_lookup_key = 'plan_premium_monthly' WHERE tier = 'premium';
