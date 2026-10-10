-- Popular Boteco do Zé com dados de balada para a demo pública
DO $$
DECLARE
  v_rest uuid := '22222222-0000-0000-0000-000000000001';
  v_product uuid;
BEGIN
  -- 1) Habilitar pedidos de música
  UPDATE public.restaurant_settings
  SET music_requests_enabled = true,
      music_requests_price = 10,
      music_requests_window_start = '20:00',
      music_requests_window_end = '04:00'
  WHERE restaurant_id = v_rest;

  -- 2) Limpar atrações antigas e inserir line-up para hoje (24/7 demo)
  DELETE FROM public.nightlife_acts WHERE restaurant_id = v_rest;
  INSERT INTO public.nightlife_acts (restaurant_id, artist_name, genre, description, starts_at, ends_at, sort_order, active) VALUES
    (v_rest, 'DJ Lê Costa', 'Sunset / Lounge',         'Aquecimento da noite',           date_trunc('day', now()) + interval '20 hours', date_trunc('day', now()) + interval '22 hours', 1, true),
    (v_rest, 'Banda Pé na Estrada', 'Sertanejo Raiz', 'Show ao vivo',                    date_trunc('day', now()) + interval '22 hours', date_trunc('day', now()) + interval '26 hours', 2, true),
    (v_rest, 'DJ Marcão', 'Sertanejo Universitário',   'Esquenta da pista',               date_trunc('day', now()) + interval '26 hours', date_trunc('day', now()) + interval '28 hours', 3, true),
    (v_rest, 'After Set — DJ Bia', 'House Remix',      'O fim que ninguém quer ver vir',  date_trunc('day', now()) + interval '28 hours', date_trunc('day', now()) + interval '30 hours', 4, true);

  -- 3) Hour drink ativo agora (2 horas), pega um produto qualquer do bar
  SELECT id INTO v_product FROM public.products WHERE restaurant_id = v_rest AND active = true ORDER BY created_at LIMIT 1;
  DELETE FROM public.nightlife_hour_drinks WHERE restaurant_id = v_rest;
  IF v_product IS NOT NULL THEN
    INSERT INTO public.nightlife_hour_drinks (restaurant_id, product_id, custom_name, promo_price, highlight_text, starts_at, ends_at, active) VALUES
      (v_rest, v_product, 'Caipirinha de Maracujá', 9, 'Metade do preço — só essa hora!', now() - interval '15 minutes', now() + interval '1 hour 45 minutes', true),
      (v_rest, v_product, 'Chopp Pilsen 600ml',     8, 'Geladíssimo, colarinho perfeito', now() + interval '2 hours',    now() + interval '4 hours',  true);
  END IF;
END $$;