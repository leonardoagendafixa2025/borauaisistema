-- ============ MUSIC REQUESTS (Modo Balada Fase 2) ============

-- Settings: 4 colunas no restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS music_requests_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS music_requests_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS music_requests_window_start time,
  ADD COLUMN IF NOT EXISTS music_requests_window_end time;

-- Tabela de pedidos de música
CREATE TABLE IF NOT EXISTS public.music_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  song_text text NOT NULL,
  dedication text,
  customer_name text,
  customer_phone text,
  table_label text,
  price numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending', -- pending | paid | refunded
  status text NOT NULL DEFAULT 'queued',          -- queued | playing | played | rejected
  played_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_requests_rest_status ON public.music_requests(restaurant_id, status, created_at DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_music_requests_updated_at ON public.music_requests;
CREATE TRIGGER trg_music_requests_updated_at
BEFORE UPDATE ON public.music_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.music_requests ENABLE ROW LEVEL SECURITY;

-- Public pode inserir SE music_requests_enabled=true E (sem janela OU dentro da janela horária local now())
CREATE POLICY "Public can submit music requests when enabled"
ON public.music_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_settings rs
    JOIN public.restaurants r ON r.id = rs.restaurant_id
    WHERE rs.restaurant_id = music_requests.restaurant_id
      AND rs.music_requests_enabled = true
      AND r.status IN ('active'::restaurant_status, 'trial'::restaurant_status)
      AND (
        rs.music_requests_window_start IS NULL
        OR rs.music_requests_window_end IS NULL
        OR (
          CASE
            WHEN rs.music_requests_window_start <= rs.music_requests_window_end
              THEN (now() AT TIME ZONE 'America/Sao_Paulo')::time BETWEEN rs.music_requests_window_start AND rs.music_requests_window_end
            ELSE -- janela cruza meia-noite (ex: 22h–04h)
              (now() AT TIME ZONE 'America/Sao_Paulo')::time >= rs.music_requests_window_start
              OR (now() AT TIME ZONE 'America/Sao_Paulo')::time <= rs.music_requests_window_end
          END
        )
      )
  )
);

-- Restaurant staff (DJ/atendente) gerencia
CREATE POLICY "Restaurant staff manage music requests"
ON public.music_requests
FOR ALL
TO authenticated
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

-- Super admin
CREATE POLICY "Super admins full access music requests"
ON public.music_requests
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Public pode ver a fila atual (sem dados sensíveis — vamos filtrar no client)
CREATE POLICY "Public can view recent music queue"
ON public.music_requests
FOR SELECT
TO anon, authenticated
USING (created_at > now() - interval '6 hours');

-- Realtime
ALTER TABLE public.music_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.music_requests;

-- Trigger Telegram (notificar DJ/staff sobre novo pedido)
CREATE OR REPLACE FUNCTION public.trg_telegram_music_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_telegram_event(
    NEW.restaurant_id,
    'music_request',
    jsonb_build_object(
      'request_id', NEW.id,
      'song', NEW.song_text,
      'dedication', NEW.dedication,
      'customer_name', NEW.customer_name,
      'table_label', NEW.table_label,
      'price', NEW.price,
      'payment_status', NEW.payment_status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_music_request_notify ON public.music_requests;
CREATE TRIGGER trg_music_request_notify
AFTER INSERT ON public.music_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_telegram_music_request();