
-- 1) Add billing routing fields to music_requests
ALTER TABLE public.music_requests
  ADD COLUMN IF NOT EXISTS command_id UUID REFERENCES public.table_commands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'table' CHECK (billing_mode IN ('table','command'));

CREATE INDEX IF NOT EXISTS idx_music_requests_command ON public.music_requests(command_id);

-- 2) Public RPC: list open commands for a given table label (for the customer chooser)
CREATE OR REPLACE FUNCTION public.list_open_commands_for_table(
  _restaurant_id uuid,
  _table_label text
)
RETURNS TABLE (
  id uuid,
  customer_name text,
  opened_at timestamptz,
  open_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _table_id uuid;
  _table_num int;
BEGIN
  IF _table_label IS NULL OR length(trim(_table_label)) = 0 THEN
    RETURN;
  END IF;

  -- Resolve table by exact label first, then by extracted number
  SELECT t.id INTO _table_id FROM public.restaurant_tables t
    WHERE t.restaurant_id = _restaurant_id
      AND (t.label = _table_label OR t.label ILIKE _table_label)
    LIMIT 1;

  IF _table_id IS NULL THEN
    BEGIN
      _table_num := (regexp_replace(_table_label, '\D', '', 'g'))::int;
      IF _table_num IS NOT NULL THEN
        SELECT t.id INTO _table_id FROM public.restaurant_tables t
          WHERE t.restaurant_id = _restaurant_id AND t.number = _table_num
          LIMIT 1;
      END IF;
    EXCEPTION WHEN others THEN
      _table_id := NULL;
    END;
  END IF;

  IF _table_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      tc.id,
      tc.customer_name,
      tc.opened_at,
      COALESCE((
        SELECT SUM(oi.total_price)
        FROM public.order_items oi
        WHERE oi.command_id = tc.id
      ), 0)::numeric AS open_total
    FROM public.table_commands tc
    WHERE tc.restaurant_id = _restaurant_id
      AND tc.table_id = _table_id
      AND tc.status = 'open'
    ORDER BY tc.opened_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_open_commands_for_table(uuid, text) TO anon, authenticated;

-- 3) Update approve_music_request to honor billing_mode + command_id
CREATE OR REPLACE FUNCTION public.approve_music_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.music_requests%ROWTYPE;
  _table_id uuid;
  _order_id uuid;
  _item_id uuid;
  _table_num int;
  _item_name text;
  _cmd_customer text;
BEGIN
  SELECT * INTO _req FROM public.music_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT (public.has_restaurant_role(auth.uid(), _req.restaurant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- If billed to a specific command, derive the table from it
  IF _req.billing_mode = 'command' AND _req.command_id IS NOT NULL THEN
    SELECT tc.table_id, tc.customer_name INTO _table_id, _cmd_customer
      FROM public.table_commands tc
      WHERE tc.id = _req.command_id AND tc.restaurant_id = _req.restaurant_id
      LIMIT 1;
  END IF;

  -- Fallback: resolve table from label
  IF _table_id IS NULL AND _req.table_label IS NOT NULL THEN
    SELECT id INTO _table_id FROM public.restaurant_tables
      WHERE restaurant_id = _req.restaurant_id
        AND (label = _req.table_label OR label ILIKE _req.table_label)
      LIMIT 1;

    IF _table_id IS NULL THEN
      BEGIN
        _table_num := (regexp_replace(_req.table_label, '\D', '', 'g'))::int;
        IF _table_num IS NOT NULL THEN
          SELECT id INTO _table_id FROM public.restaurant_tables
            WHERE restaurant_id = _req.restaurant_id AND number = _table_num
            LIMIT 1;
        END IF;
      EXCEPTION WHEN others THEN
        _table_id := NULL;
      END;
    END IF;
  END IF;

  IF _table_id IS NOT NULL AND _req.price > 0 THEN
    -- Find existing open dine-in order for this table
    SELECT id INTO _order_id FROM public.orders
      WHERE restaurant_id = _req.restaurant_id
        AND table_id = _table_id
        AND type = 'dine_in'::order_type
        AND status NOT IN ('completed'::order_status, 'cancelled'::order_status)
      ORDER BY created_at DESC
      LIMIT 1;

    IF _order_id IS NULL THEN
      INSERT INTO public.orders (restaurant_id, table_id, type, status, customer_name, subtotal, total, payment_status)
      VALUES (_req.restaurant_id, _table_id, 'dine_in'::order_type, 'new'::order_status,
              COALESCE(_cmd_customer, _req.customer_name, 'Mesa'), _req.price, _req.price, 'pending')
      RETURNING id INTO _order_id;
    END IF;

    -- Build item label depending on billing mode
    IF _req.billing_mode = 'command' AND _req.command_id IS NOT NULL THEN
      _item_name := '🎵 Música (' || COALESCE(_cmd_customer, 'comanda') || '): ' || _req.song_text;
    ELSE
      _item_name := '🎵 Músicas da mesa: ' || _req.song_text;
    END IF;

    INSERT INTO public.order_items (order_id, command_id, name, qty, unit_price, total_price, notes)
    VALUES (
      _order_id,
      CASE WHEN _req.billing_mode = 'command' THEN _req.command_id ELSE NULL END,
      _item_name,
      1, _req.price, _req.price,
      COALESCE('Dedicatória: ' || _req.dedication, 'Pedido de música')
    )
    RETURNING id INTO _item_id;

    UPDATE public.orders
      SET subtotal = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0),
          total = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0) + COALESCE(delivery_fee, 0) - COALESCE(discount, 0),
          updated_at = now()
      WHERE id = _order_id;
  END IF;

  UPDATE public.music_requests
    SET status = 'queued',
        order_item_id = _item_id,
        payment_status = CASE WHEN _item_id IS NOT NULL THEN 'pending' ELSE payment_status END,
        updated_at = now()
    WHERE id = _request_id;

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'order_id', _order_id,
    'order_item_id', _item_id,
    'linked_to_tab', _item_id IS NOT NULL,
    'billing_mode', _req.billing_mode,
    'command_id', _req.command_id
  );
END;
$$;
