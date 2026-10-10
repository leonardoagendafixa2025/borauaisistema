UPDATE public.subscriptions s
SET monthly_price = p.price,
    updated_at = now()
FROM public.subscription_plans p
WHERE s.plan_id = p.id
  AND s.monthly_price <> p.price;