import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function buildMessage(eventType: string, p: any): string {
  switch (eventType) {
    case 'new_restaurant':
      return [
        `🎉 <b>Novo restaurante cadastrado!</b>`,
        ``,
        `🏪 <b>${p.name}</b>`,
        `🔗 /${p.slug}`,
        p.owner_email ? `✉️ ${p.owner_email}` : null,
        p.plan ? `📦 Plano: <b>${p.plan}</b>` : null,
        ``,
        `Total na plataforma: <b>${p.total_active}</b> ativos`,
      ].filter(Boolean).join('\n');

    case 'payment_failed':
      return [
        `🚨 <b>Pagamento recusado</b>`,
        ``,
        `🏪 ${p.restaurant_name}`,
        `💳 Valor: <b>${fmt(p.amount)}</b>`,
        p.reason ? `📝 Motivo: ${p.reason}` : null,
        ``,
        `⚠️ Cliente em risco de churn — vale follow-up`,
      ].filter(Boolean).join('\n');

    case 'subscription_cancelled':
      return [
        `🔴 <b>Assinatura cancelada</b>`,
        ``,
        `🏪 ${p.restaurant_name}`,
        p.plan ? `📦 Plano: ${p.plan}` : null,
        p.was_active_for ? `⏱️ Cliente por: ${p.was_active_for}` : null,
        ``,
        `MRR perdido: <b>${fmt(p.mrr_lost || 0)}</b>`,
      ].filter(Boolean).join('\n');

    case 'trial_expiring':
      return [
        `⏰ <b>Trial expirando em ${p.days_left} dia${p.days_left === 1 ? '' : 's'}</b>`,
        ``,
        `🏪 ${p.restaurant_name}`,
        p.owner_email ? `✉️ ${p.owner_email}` : null,
        p.owner_phone ? `📱 ${p.owner_phone}` : null,
        ``,
        `💡 Hora de fazer follow-up de venda`,
      ].filter(Boolean).join('\n');

    case 'trial_expired':
      return [
        `❌ <b>Trial expirou e foi suspenso</b>`,
        ``,
        `🏪 ${p.restaurant_name}`,
        p.owner_email ? `✉️ ${p.owner_email}` : null,
        ``,
        `Considere oferecer extensão ou desconto`,
      ].filter(Boolean).join('\n');

    case 'daily_platform_summary': {
      const lines = [
        `📊 <b>Resumo diário — Bora Uai</b>`,
        `📅 ${new Date(p.date).toLocaleDateString('pt-BR')}`,
        ``,
        `🏪 Restaurantes ativos: <b>${p.active_count}</b>`,
        `🆓 Em trial: <b>${p.trial_count}</b>`,
        `🆕 Novos hoje: <b>${p.new_today}</b>`,
        ``,
        `💰 MRR atual: <b>${fmt(p.mrr)}</b>`,
        `💸 Faturado hoje: <b>${fmt(p.revenue_today)}</b>`,
        `🛒 Pedidos hoje (plataforma): <b>${p.orders_today}</b>`,
      ];
      if (p.payments_failed_today > 0) {
        lines.push(``, `⚠️ Pagamentos recusados hoje: <b>${p.payments_failed_today}</b>`);
      }
      if (p.cancelled_today > 0) {
        lines.push(`🔴 Cancelamentos hoje: <b>${p.cancelled_today}</b>`);
      }
      return lines.join('\n');
    }

    case 'critical_error':
      return [
        `🚨🚨 <b>ERRO CRÍTICO</b>`,
        ``,
        `📦 ${p.context || 'Sistema'}`,
        `❗ ${p.message}`,
        p.details ? `\n<pre>${String(p.details).slice(0, 500)}</pre>` : null,
      ].filter(Boolean).join('\n');

    default:
      return `📢 <b>${eventType}</b>\n${JSON.stringify(p, null, 2).slice(0, 500)}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_BOT_TOKEN && (!LOVABLE_API_KEY || !TELEGRAM_API_KEY)) {
    return new Response(JSON.stringify({ error: 'Telegram not configured (missing TELEGRAM_BOT_TOKEN or LOVABLE_API_KEY/TELEGRAM_API_KEY)' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { event_type, payload } = await req.json();
    if (!event_type) {
      return new Response(JSON.stringify({ error: 'event_type required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: setting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'master_telegram_chat_id')
      .maybeSingle();

    const chatId = setting?.value ? String(setting.value).replace(/^"|"$/g, '') : null;
    if (!chatId) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_master_chat' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = buildMessage(event_type, payload || {});

    const sendUrl = TELEGRAM_BOT_TOKEN
      ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
      : `${GATEWAY_URL}/sendMessage`;

    const sendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!TELEGRAM_BOT_TOKEN) {
      sendHeaders['Authorization'] = `Bearer ${LOVABLE_API_KEY}`;
      sendHeaders['X-Connection-Api-Key'] = TELEGRAM_API_KEY || '';
    }

    const r = await fetch(sendUrl, {
      method: 'POST',
      headers: sendHeaders,
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('master-notify sendMessage failed:', err);
      return new Response(JSON.stringify({ error: err }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('master-notify error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
