-- ============================================
-- Telegram staff links (multi-garçom por restaurante)
-- ============================================
CREATE TABLE IF NOT EXISTS public.telegram_staff_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  staff_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_staff_restaurant ON public.telegram_staff_links(restaurant_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_tg_staff_chat ON public.telegram_staff_links(chat_id);

ALTER TABLE public.telegram_staff_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage telegram links"
  ON public.telegram_staff_links FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access telegram links"
  ON public.telegram_staff_links FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));