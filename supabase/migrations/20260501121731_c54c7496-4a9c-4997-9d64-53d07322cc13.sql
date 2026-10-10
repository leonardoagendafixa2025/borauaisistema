-- 1. Link column
ALTER TABLE public.music_requests
  ADD COLUMN IF NOT EXISTS order_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_music_requests_order_item ON public.music_requests(order_item_id);

-- 2. Approve helper: links request to the open dine-in tab for the matching table label
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
BEGIN
  SELECT * INTO _req FROM public.music_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Permission check: must have role on this restaurant or be super admin
  IF NOT (public.has_restaurant_role(auth.uid(), _req.restaurant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Try to resolve table by label / number
  IF _req.table_label IS NOT NULL THEN
    -- Try by label first
    SELECT id INTO _table_id FROM public.restaurant_tables
      WHERE restaurant_id = _req.restaurant_id
        AND (label = _req.table_label OR label ILIKE _req.table_label)
      LIMIT 1;

    -- Fallback: extract number from label like "Mesa 5" or "5"
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

  -- If we have a table and price > 0, find/create open dine-in order and add item
  IF _table_id IS NOT NULL AND _req.price > 0 THEN
    SELECT id INTO _order_id FROM public.orders
      WHERE restaurant_id = _req.restaurant_id
        AND table_id = _table_id
        AND type = 'dine_in'::order_type
        AND status NOT IN ('completed'::order_status, 'cancelled'::order_status)
        AND created_at > now() - interval '12 hours'
      ORDER BY created_at DESC
      LIMIT 1;

    -- If no open tab, create a lightweight one
    IF _order_id IS NULL THEN
      INSERT INTO public.orders (restaurant_id, table_id, type, status, customer_name, subtotal, total, payment_status)
      VALUES (_req.restaurant_id, _table_id, 'dine_in'::order_type, 'new'::order_status,
              COALESCE(_req.customer_name, 'Mesa'), _req.price, _req.price, 'pending')
      RETURNING id INTO _order_id;
    END IF;

    -- Insert music item in the tab
    INSERT INTO public.order_items (order_id, name, qty, unit_price, total_price, notes)
    VALUES (_order_id, '🎵 Pedido de música: ' || _req.song_text, 1, _req.price, _req.price,
            COALESCE('Dedicatória: ' || _req.dedication, 'Pedido de música'))
    RETURNING id INTO _item_id;

    -- Recompute order totals
    UPDATE public.orders
      SET subtotal = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0),
          total = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0) + COALESCE(delivery_fee, 0) - COALESCE(discount, 0),
          updated_at = now()
      WHERE id = _order_id;
  END IF;

  -- Update request
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
    'linked_to_tab', _item_id IS NOT NULL
  );
END;
$$;

-- 3. Reject helper: removes linked item and refunds
CREATE OR REPLACE FUNCTION public.reject_music_request(_request_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.music_requests%ROWTYPE;
  _order_id uuid;
  _refunded boolean := false;
BEGIN
  SELECT * INTO _req FROM public.music_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT (public.has_restaurant_role(auth.uid(), _req.restaurant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- If linked to a tab item, remove it and recompute order
  IF _req.order_item_id IS NOT NULL THEN
    SELECT order_id INTO _order_id FROM public.order_items WHERE id = _req.order_item_id;

    DELETE FROM public.order_items WHERE id = _req.order_item_id;
    _refunded := true;

    IF _order_id IS NOT NULL THEN
      UPDATE public.orders
        SET subtotal = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0),
            total = COALESCE((SELECT SUM(total_price) FROM public.order_items WHERE order_id = _order_id), 0) + COALESCE(delivery_fee, 0) - COALESCE(discount, 0),
            updated_at = now()
        WHERE id = _order_id;
    END IF;
  END IF;

  UPDATE public.music_requests
    SET status = 'rejected',
        rejected_reason = COALESCE(_reason, 'Não disponível'),
        payment_status = CASE WHEN _refunded OR payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
        order_item_id = NULL,
        updated_at = now()
    WHERE id = _request_id;

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'refunded_from_tab', _refunded,
    'order_id', _order_id
  );
END;
$$;