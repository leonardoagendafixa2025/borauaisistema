
UPDATE public.subscription_plans 
SET price = 69.99 
WHERE tier = 'basic';

UPDATE public.subscription_plans 
SET price = 119.99 
WHERE tier = 'professional';

UPDATE public.subscription_plans 
SET price = 199.99 
WHERE tier = 'premium';
