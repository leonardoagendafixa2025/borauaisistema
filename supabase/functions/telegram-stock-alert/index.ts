import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_BOT_TOKEN && (!LOVABLE_API_KEY || !TELEGRAM_API_KEY)) {
    return new Response(JSON.stringify({ error: 'Telegram not configured (missing TELEGRAM_BOT_TOKEN or LOVABLE_API_KEY/TELEGRAM_API_KEY)' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { restaurant_id } = await req.json();

    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get restaurant settings (telegram_chat_id)
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('telegram_chat_id')
      .eq('restaurant_id', restaurant_id)
      .single();

    const chatId = settings?.telegram_chat_id;
    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Telegram not configured for this restaurant' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get restaurant name
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurant_id)
      .single();

    // Get low stock items
    const { data: lowItems } = await supabase
      .from('inventory_items')
      .select('name, current_stock, min_stock, unit')
      .eq('restaurant_id', restaurant_id)
      .eq('active', true);

    const lowStock = (lowItems || []).filter(
      (i: any) => i.current_stock <= i.min_stock
    );

    if (lowStock.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No low stock items' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build message
    const lines = lowStock.map(
      (i: any) => `• <b>${i.name}</b>: ${i.current_stock} ${i.unit} (mín: ${i.min_stock})`
    );

    const text = `⚠️ <b>Alerta de Estoque Baixo</b>\n🏪 ${restaurant?.name || 'Restaurante'}\n\n${lines.join('\n')}\n\n📦 Verifique seu estoque!`;

    const sendUrl = TELEGRAM_BOT_TOKEN
      ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
      : `${GATEWAY_URL}/sendMessage`;

    const sendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!TELEGRAM_BOT_TOKEN) {
      sendHeaders['Authorization'] = `Bearer ${LOVABLE_API_KEY}`;
      sendHeaders['X-Connection-Api-Key'] = TELEGRAM_API_KEY || '';
    }

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: sendHeaders,
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Telegram API failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ ok: true, sent: lowStock.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error sending Telegram alert:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
