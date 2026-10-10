CREATE OR REPLACE FUNCTION public.driver_list_history(
  _driver_id uuid,
  _pin text,
  _limit int DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  number int,
  customer_name text,
  address text,
  total numeric,
  delivery_fee numeric,
  payment_method text,
  status order_status,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery_drivers WHERE id = _driver_id AND access_pin = _pin) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT o.id, o.number, o.customer_name, o.address, o.total, o.delivery_fee,
           o.payment_method, o.status, o.dispatched_at, o.delivered_at, o.created_at
    FROM orders o
    WHERE o.driver_id = _driver_id
      AND o.status = 'completed'::order_status
    ORDER BY COALESCE(o.delivered_at, o.updated_at) DESC
    LIMIT GREATEST(_limit, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_earnings_summary(
  _driver_id uuid,
  _pin text
)
RETURNS TABLE(
  total_deliveries bigint,
  total_earnings numeric,
  today_deliveries bigint,
  today_earnings numeric,
  week_deliveries bigint,
  week_earnings numeric,
  month_deliveries bigint,
  month_earnings numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery_drivers WHERE id = _driver_id AND access_pin = _pin) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(o.delivery_fee), 0)::numeric,
    COUNT(*) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('day', now()))::bigint,
    COALESCE(SUM(o.delivery_fee) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('day', now())), 0)::numeric,
    COUNT(*) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('week', now()))::bigint,
    COALESCE(SUM(o.delivery_fee) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('week', now())), 0)::numeric,
    COUNT(*) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('month', now()))::bigint,
    COALESCE(SUM(o.delivery_fee) FILTER (WHERE COALESCE(o.delivered_at, o.updated_at) >= date_trunc('month', now())), 0)::numeric
  FROM orders o
  WHERE o.driver_id = _driver_id
    AND o.status = 'completed'::order_status;
END;
$$;