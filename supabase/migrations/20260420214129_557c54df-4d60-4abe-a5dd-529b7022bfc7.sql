
CREATE TABLE public.table_partial_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  table_id UUID NOT NULL,
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  paid_by TEXT,
  created_by UUID,
  closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpp_table ON public.table_partial_payments(table_id, closed);
CREATE INDEX idx_tpp_restaurant ON public.table_partial_payments(restaurant_id);

ALTER TABLE public.table_partial_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage partial payments"
ON public.table_partial_payments
FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access partial payments"
ON public.table_partial_payments
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
