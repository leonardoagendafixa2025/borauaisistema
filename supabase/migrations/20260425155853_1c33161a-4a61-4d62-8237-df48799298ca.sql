
-- Tabela de vínculo Telegram do cliente
CREATE TABLE public.customer_telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  chat_id text,
  link_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | active | revoked
  notify_status_updates boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  linked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ctl_customer ON public.customer_telegram_links(customer_id);
CREATE INDEX idx_ctl_chat ON public.customer_telegram_links(chat_id) WHERE chat_id IS NOT NULL;

ALTER TABLE public.customer_telegram_links ENABLE ROW LEVEL SECURITY;

-- Cliente autenticado gerencia seus próprios vínculos
CREATE POLICY "Customers manage own telegram links"
ON public.customer_telegram_links
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_id AND c.user_id = auth.uid()));

-- Anônimo pode inserir token pendente (caso de pedido sem login — futuro)
CREATE POLICY "Anyone can create pending link tokens"
ON public.customer_telegram_links
FOR INSERT TO anon, authenticated
WITH CHECK (status = 'pending');

CREATE POLICY "Super admin full access ctl"
ON public.customer_telegram_links
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_ctl_updated_at
BEFORE UPDATE ON public.customer_telegram_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: notificar mudança de status do pedido pro cliente
CREATE OR REPLACE FUNCTION public.trg_telegram_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.customer_id IS NOT NULL THEN
    PERFORM notify_telegram_event(
      NEW.restaurant_id,
      'order_status_customer',
      jsonb_build_object(
        'order_id', NEW.id,
        'number', NEW.number,
        'status', NEW.status,
        'customer_id', NEW.customer_id,
        'type', NEW.type,
        'total', NEW.total
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_order_status_change ON public.orders;
CREATE TRIGGER telegram_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_telegram_order_status_change();
