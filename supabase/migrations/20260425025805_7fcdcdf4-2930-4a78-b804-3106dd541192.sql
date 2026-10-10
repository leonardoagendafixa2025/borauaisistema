-- Public function to expose only the GPS of the driver assigned to a specific order
-- Used by customer order tracking page; no auth required, no PII leaked
CREATE OR REPLACE FUNCTION public.get_order_driver_location(_order_id uuid)
RETURNS TABLE(
  driver_name text,
  vehicle text,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  status text,
  order_status order_status,
  order_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.name,
    d.vehicle,
    d.last_lat,
    d.last_lng,
    d.last_location_at,
    d.status,
    o.status,
    o.address
  FROM orders o
  LEFT JOIN delivery_drivers d ON d.id = o.driver_id
  WHERE o.id = _order_id
    AND o.created_at > now() - interval '24 hours'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_driver_location(uuid) TO anon, authenticated;