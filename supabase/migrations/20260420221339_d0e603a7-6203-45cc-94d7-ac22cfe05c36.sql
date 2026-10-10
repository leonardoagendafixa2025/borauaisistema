ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sold_by_weight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS price_per_kg numeric;