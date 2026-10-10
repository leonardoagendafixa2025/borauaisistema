-- Tags em satisfaction_surveys
ALTER TABLE public.satisfaction_surveys 
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

-- Único survey por pedido
CREATE UNIQUE INDEX IF NOT EXISTS satisfaction_surveys_order_unique 
  ON public.satisfaction_surveys(order_id) WHERE order_id IS NOT NULL;

-- Driver ratings
CREATE TABLE IF NOT EXISTS public.driver_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  customer_name text,
  customer_phone text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags text[] DEFAULT '{}'::text[],
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver ON public.driver_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_restaurant ON public.driver_ratings(restaurant_id);

ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

-- Cliente anônimo pode inserir desde que pedido exista, esteja completo e tenha < 7 dias
CREATE POLICY "Public can submit driver rating for recent completed orders"
  ON public.driver_ratings FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = driver_ratings.order_id
        AND o.driver_id = driver_ratings.driver_id
        AND o.restaurant_id = driver_ratings.restaurant_id
        AND o.status = 'completed'
        AND o.created_at > now() - interval '7 days'
    )
  );

-- Equipe do restaurante pode ver
CREATE POLICY "Restaurant staff can view driver ratings"
  ON public.driver_ratings FOR SELECT
  USING (has_restaurant_role(auth.uid(), restaurant_id));

-- Super admin acesso total
CREATE POLICY "Super admins full access driver ratings"
  ON public.driver_ratings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Cliente que fez pedido pode ver a própria avaliação
CREATE POLICY "Customer can view own driver rating"
  ON public.driver_ratings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM orders o JOIN customers c ON c.id = o.customer_id
            WHERE o.id = driver_ratings.order_id AND c.user_id = auth.uid())
  );

-- View de resumo por entregador (security_invoker para respeitar RLS)
CREATE OR REPLACE VIEW public.driver_ratings_summary
WITH (security_invoker = on) AS
SELECT 
  d.id AS driver_id,
  d.restaurant_id,
  d.name,
  COALESCE(AVG(r.rating)::numeric(3,2), 0) AS avg_rating,
  COUNT(r.id)::int AS total_ratings
FROM delivery_drivers d
LEFT JOIN driver_ratings r ON r.driver_id = d.id
GROUP BY d.id, d.restaurant_id, d.name;