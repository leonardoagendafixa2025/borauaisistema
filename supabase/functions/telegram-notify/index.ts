import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const typeLabels: Record<string, string> = {
  delivery: '🚚 Delivery',
  pickup: '🥡 Retirada',
  dine_in: '🍽️ Mesa',
};

interface BuiltMessage {
  text: string;
  reply_markup?: any;
}

function buildMessage(eventType: string, p: any): BuiltMessage {
  switch (eventType) {
    case 'new_order': {
      const text = [
        `🆕 <b>Novo pedido #${p.number}</b>`,
        `${typeLabels[p.type] || p.type}`,
        ``,
        `👤 <b>${p.customer_name}</b>${p.customer_phone ? ` — ${p.customer_phone}` : ''}`,
        p.address ? `📍 ${p.address}` : null,
        ``,
        `💰 Total: <b>${fmt(p.total)}</b>`,
        p.payment_method ? `💳 ${p.payment_method}` : null,
      ].filter(Boolean).join('\n');
      return {
        text,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Aceitar', callback_data: `accept_order:${p.order_id}` },
            { text: '❌ Recusar', callback_data: `reject_order:${p.order_id}` },
          ]],
        },
      };
    }
    case 'waiter_call': {
      const isBill = p.type === 'request_bill';
      const text = isBill
        ? `💰 <b>Pedido de conta</b>\n📍 ${p.table_label}`
        : `🔔 <b>Chamada de garçom</b>\n📍 ${p.table_label}`;
      return {
        text,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Atendido', callback_data: `done_call:${p.call_id}` },
          ]],
        },
      };
    }
    case 'bad_review': {
      const text = [
        `📉 <b>Avaliação ruim recebida</b>`,
        `Nota: <b>${p.score}/10</b>`,
        p.customer_name ? `👤 ${p.customer_name}` : null,
        p.comment ? `💬 "${p.comment}"` : null,
      ].filter(Boolean).join('\n');
      return { text };
    }
    case 'delivery_sla_breach': {
      const text = [
        `⚠️ <b>ATRASO no pedido #${p.number}</b>`,
        `${typeLabels[p.type] || p.type}`,
        ``,
        `👤 ${p.customer_name}${p.customer_phone ? ` — ${p.customer_phone}` : ''}`,
        p.address ? `📍 ${p.address}` : null,
        ``,
        `⏱️ Status: <b>${p.status}</b> há <b>${p.minutes_late} min</b> além do previsto`,
        p.driver_name ? `🛵 Entregador: ${p.driver_name}` : `🛵 Sem entregador atribuído`,
        `💰 Total: ${fmt(p.total)}`,
      ].filter(Boolean).join('\n');
      return { text };
    }
    case 'expense_due': {
      return { text: `💸 <b>Despesa vence amanhã</b>\n${p.description}\nValor: <b>${fmt(p.amount)}</b>${p.supplier ? `\nFornecedor: ${p.supplier}` : ''}` };
    }
    case 'order_status_customer': {
      const labels: Record<string, string> = {
        accepted: '✅ <b>Pedido aceito!</b>\nSeu pedido foi confirmado e já entrou na fila.',
        preparing: '👨‍🍳 <b>Em preparo</b>\nSua comida está sendo preparada agora.',
        ready: '📦 <b>Pedido pronto!</b>\nJá pode retirar.',
        delivering: '🛵 <b>Saiu para entrega</b>\nO entregador está a caminho!',
        waiting_pickup: '📦 <b>Pronto para retirada</b>',
        completed: '🎉 <b>Pedido concluído!</b>\nObrigado pela preferência. Volte sempre!',
        cancelled: '❌ <b>Pedido cancelado</b>\nEntre em contato com o estabelecimento se tiver dúvidas.',
      };
      const head = labels[p.status] || `📢 Status: ${p.status}`;
      const isFinal = p.status === 'completed' || p.status === 'cancelled';
      return {
        text: `${head}\n\n📋 Pedido <b>#${p.number}</b> — ${fmt(p.total)}`,
        // Always show controls so the customer can manage notifications from chat
        reply_markup: isFinal ? undefined : {
          inline_keyboard: [[
            { text: '🔕 Pausar avisos', callback_data: `pause_notify:${p.customer_id}` },
            { text: '🚫 Desvincular', callback_data: `unlink_customer:${p.customer_id}` },
          ]],
        },
      };
    }
    case 'music_status_customer': {
      if (p.status === 'queued') {
        return {
          text: [
            `🎵 <b>Sua música foi aprovada!</b>`,
            ``,
            `🎶 ${p.song}`,
            p.dedication ? `💌 "${p.dedication}"` : null,
            p.price > 0 ? `💰 Lançado na conta: <b>${fmt(p.price)}</b>` : null,
            ``,
            `🎧 Em breve toca aí!`,
          ].filter(Boolean).join('\n'),
        };
      }
      return {
        text: [
          `🎵 <b>Sua música não pôde tocar</b>`,
          ``,
          `🎶 ${p.song}`,
          p.rejected_reason ? `📝 Motivo: ${p.rejected_reason}` : null,
          p.price > 0 ? `💰 Valor estornado da sua conta` : null,
          ``,
          `Tenta outra que rola! 🎉`,
        ].filter(Boolean).join('\n'),
      };
    }
    case 'broadcast_promo': {
      return {
        text: [
          `📣 <b>${p.restaurant_name}</b>`,
          ``,
          p.message,
        ].join('\n'),
      };
    }
    case 'daily_summary': {
      const top = (p.top_products || []) as { name: string; qty: number }[];
      const topLines = top.length > 0
        ? ['', '🏆 <b>Top produtos:</b>', ...top.map((t, i) => `${i + 1}. ${t.name} — ${t.qty}x`)]
        : [];
      const text = [
        `📊 <b>Resumo do dia</b>`,
        `🏪 ${p.restaurant_name}`,
        ``,
        `🛒 Pedidos: <b>${p.orders_count}</b>`,
        `💰 Faturamento: <b>${fmt(p.revenue)}</b>`,
        `🎯 Ticket médio: <b>${fmt(p.avg_ticket)}</b>`,
        p.nps !== null ? `⭐ NPS do dia: <b>${p.nps}</b>` : null,
        p.expenses > 0 ? `💸 Despesas: <b>${fmt(p.expenses)}</b>` : null,
        ...topLines,
      ].filter(Boolean).join('\n');
      return { text };
    }
    default:
      return { text: `📢 ${eventType}` };
  }
}

async function sendTo(chatId: string, msg: BuiltMessage, lk?: string, tk?: string) {
  const body: any = { chat_id: chatId, text: msg.text, parse_mode: 'HTML' };
  if (msg.reply_markup) body.reply_markup = msg.reply_markup;

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (botToken) {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error(`sendMessage to ${chatId} failed:`, await r.text());
    return r.ok;
  }

  const r = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lk}`,
      'X-Connection-Api-Key': tk || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) console.error(`sendMessage to ${chatId} failed:`, await r.text());
  return r.ok;
}

// Events that should also notify staff (waiters)
const STAFF_EVENTS = new Set(['waiter_call']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_BOT_TOKEN && (!LOVABLE_API_KEY || !TELEGRAM_API_KEY)) {
    return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { restaurant_id, event_type, payload } = await req.json();
    if (!restaurant_id || !event_type) {
      return new Response(JSON.stringify({ error: 'restaurant_id and event_type required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Collect target chats: customer-only events go ONLY to the customer
    const targets = new Set<string>();

    if (event_type === 'order_status_customer') {
      const customerId = payload?.customer_id;
      if (customerId) {
        const { data: links } = await supabase
          .from('customer_telegram_links')
          .select('chat_id, notify_status_updates')
          .eq('customer_id', customerId)
          .eq('status', 'active');
        (links || [])
          .filter((l: any) => l.notify_status_updates && l.chat_id)
          .forEach((l: any) => targets.add(l.chat_id));
      }
    } else if (event_type === 'music_status_customer') {
      const phone = (payload?.customer_phone || '').replace(/\D/g, '');
      if (phone.length >= 8) {
        const { data: allCustomers } = await supabase
          .from('customers')
          .select('id, phone')
          .eq('restaurant_id', restaurant_id);
        const ids = (allCustomers || [])
          .filter((c: any) => (c.phone || '').replace(/\D/g, '') === phone)
          .map((c: any) => c.id);
        if (ids.length > 0) {
          const { data: links } = await supabase
            .from('customer_telegram_links')
            .select('chat_id, notify_status_updates')
            .in('customer_id', ids)
            .eq('status', 'active');
          (links || [])
            .filter((l: any) => l.notify_status_updates && l.chat_id)
            .forEach((l: any) => targets.add(l.chat_id));
        }
      }
    } else if (event_type === 'broadcast_promo') {
      // All active linked customers of this restaurant
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('restaurant_id', restaurant_id);
      const ids = (customers || []).map((c: any) => c.id);
      if (ids.length > 0) {
        const { data: links } = await supabase
          .from('customer_telegram_links')
          .select('chat_id, notify_status_updates')
          .in('customer_id', ids)
          .eq('status', 'active');
        (links || [])
          .filter((l: any) => l.notify_status_updates && l.chat_id)
          .forEach((l: any) => targets.add(l.chat_id));
      }
    } else {
      // Owner + (optionally) staff
      const { data: settings } = await supabase
        .from('restaurant_settings')
        .select('telegram_chat_id')
        .eq('restaurant_id', restaurant_id)
        .single();
      if (settings?.telegram_chat_id) targets.add(settings.telegram_chat_id);

      if (STAFF_EVENTS.has(event_type)) {
        const { data: staff } = await supabase
          .from('telegram_staff_links')
          .select('chat_id')
          .eq('restaurant_id', restaurant_id)
          .eq('active', true);
        (staff || []).forEach((s: any) => targets.add(s.chat_id));
      }
    }

    if (targets.size === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_targets' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const msg = buildMessage(event_type, payload || {});
    const results = await Promise.all(
      Array.from(targets).map((c) => sendTo(c, msg, LOVABLE_API_KEY, TELEGRAM_API_KEY))
    );

    return new Response(JSON.stringify({ ok: true, sent: results.filter(Boolean).length, total: targets.size }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('telegram-notify error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
