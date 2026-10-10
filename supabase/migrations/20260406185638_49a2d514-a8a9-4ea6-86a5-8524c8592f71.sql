
CREATE TABLE public.cashier_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff can manage cashier sessions"
ON public.cashier_sessions FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access cashier sessions"
ON public.cashier_sessions FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_cashier_sessions_restaurant ON public.cashier_sessions(restaurant_id, opened_at DESC);
