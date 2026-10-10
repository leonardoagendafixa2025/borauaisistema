
CREATE OR REPLACE FUNCTION public.get_table_open_orders(_restaurant_id uuid, _table_id uuid)
RETURNS TABLE(
  id uuid,
  number integer,
  status order_status,
  type order_type,
  subtotal numeric,
  delivery_fee numeric,
  discount numeric,
  total numeric,
  payment_status text,
  payment_method text,
  customer_name text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.number, o.status, o.type, o.subtotal, o.delivery_fee, o.discount, o.total,
    o.payment_status, o.payment_method, o.customer_name, o.notes,
    o.created_at, o.updated_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'name', oi.name,
        'qty', oi.qty,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'options', oi.options,
        'notes', oi.notes
      ) ORDER BY oi.created_at)
      FROM order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb) AS items
  FROM orders o
  WHERE o.restaurant_id = _restaurant_id
    AND o.table_id = _table_id
    AND o.type = 'dine_in'::order_type
    AND o.status <> 'cancelled'::order_status
    AND o.created_at > now() - interval '8 hours'
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_open_orders(uuid, uuid) TO anon, authenticated;
