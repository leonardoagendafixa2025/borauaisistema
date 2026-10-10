ALTER TABLE public.subscription_payments
  DROP COLUMN IF EXISTS mp_payment_id,
  DROP COLUMN IF EXISTS mp_preapproval_id,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;