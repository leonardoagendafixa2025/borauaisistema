-- Tabela de comandas individuais por mesa
CREATE TABLE public.table_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_commands_table ON public.table_commands(table_id, status);
CREATE INDEX idx_table_commands_restaurant ON public.table_commands(restaurant_id);

ALTER TABLE public.table_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage commands"
ON public.table_commands FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access commands"
ON public.table_commands FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anon can view recent commands"
ON public.table_commands FOR SELECT
TO anon, authenticated
USING (opened_at > now() - interval '4 hours');

CREATE POLICY "Anon can insert commands"
ON public.table_commands FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE TRIGGER update_table_commands_updated_at
BEFORE UPDATE ON public.table_commands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular itens de pedido a uma comanda específica (opcional)
ALTER TABLE public.order_items
ADD COLUMN command_id UUID REFERENCES public.table_commands(id) ON DELETE SET NULL;

CREATE INDEX idx_order_items_command ON public.order_items(command_id);