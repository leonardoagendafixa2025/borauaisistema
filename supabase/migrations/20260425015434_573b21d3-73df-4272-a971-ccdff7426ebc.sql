ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS quick_sale_auto_schedule boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quick_sale_start_time time NULL,
  ADD COLUMN IF NOT EXISTS quick_sale_end_time time NULL,
  ADD COLUMN IF NOT EXISTS quick_sale_active_days integer[] NOT NULL DEFAULT ARRAY[5,6]::integer[],
  ADD COLUMN IF NOT EXISTS quick_sale_welcome_message text NULL,
  ADD COLUMN IF NOT EXISTS quick_sale_thankyou_message text NULL;