-- Tabela de pulseiras/fichas para Modo Balada
CREATE TABLE public.nightlife_wristbands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active | closed | lost
  tier text NOT NULL DEFAULT 'standard', -- standard | vip
  credit_limit numeric NOT NULL DEFAULT 0, -- 0 = sem limite
  total_consumed numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  customer_name text,
  customer_phone text,
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  issued_by uuid,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);

CREATE INDEX idx_wristbands_restaurant_status ON public.nightlife_wristbands(restaurant_id, status);
CREATE INDEX idx_wristbands_code ON public.nightlife_wristbands(restaurant_id, code);

ALTER TABLE public.nightlife_wristbands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage wristbands"
  ON public.nightlife_wristbands FOR ALL TO authenticated
  USING (has_restaurant_role(auth.uid(), restaurant_id))
  WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access wristbands"
  ON public.nightlife_wristbands FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_wristbands_updated_at
  BEFORE UPDATE ON public.nightlife_wristbands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular pedidos a pulseiras
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wristband_id uuid,
  ADD COLUMN IF NOT EXISTS wristband_code text,
  ADD COLUMN IF NOT EXISTS bar_status text, -- null | pending | preparing | ready | delivered
  ADD COLUMN IF NOT EXISTS bar_pickup_code text,
  ADD COLUMN IF NOT EXISTS bar_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS bar_delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_bar_status ON public.orders(restaurant_id, bar_status) WHERE bar_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_wristband ON public.orders(wristband_id) WHERE wristband_id IS NOT NULL;

-- Trigger: ao criar pedido com wristband, soma consumo; ao mudar payment_status, soma pagamento
CREATE OR REPLACE FUNCTION public.update_wristband_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.wristband_id IS NOT NULL THEN
    UPDATE public.nightlife_wristbands
      SET total_consumed = total_consumed + COALESCE(NEW.total, 0),
          total_paid = total_paid + CASE WHEN NEW.payment_status = 'paid' THEN COALESCE(NEW.total,0) ELSE 0 END
      WHERE id = NEW.wristband_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.wristband_id IS NOT NULL THEN
    -- Se status pagamento mudou para paid
    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status) AND NEW.payment_status = 'paid' THEN
      UPDATE public.nightlife_wristbands
        SET total_paid = total_paid + COALESCE(NEW.total,0)
        WHERE id = NEW.wristband_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_update_wristband ON public.orders;
CREATE TRIGGER trg_orders_update_wristband
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_wristband_totals();

-- Realtime para painel do bar
ALTER PUBLICATION supabase_realtime ADD TABLE public.nightlife_wristbands;