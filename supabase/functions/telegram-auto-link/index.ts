import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

async function tg(method: string, body: any, lovableKey?: string, tgKey?: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (botToken) {
    return fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return fetch(`${GATEWAY_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': tgKey || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const sendMessage = (chatId: string, text: string, lk?: string, tk?: string, extra: any = {}) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra }, lk, tk);

const answerCallback = (id: string, text: string, lk?: string, tk?: string) =>
  tg('answerCallbackQuery', { callback_query_id: id, text, show_alert: false }, lk, tk);

const editMessage = (chatId: string, messageId: number, text: string, lk?: string, tk?: string) =>
  tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }, lk, tk);

async function findRestaurantByChat(supabase: any, chatId: string) {
  // Try owner chat first
  const { data: owner } = await supabase
    .from('restaurant_settings')
    .select('restaurant_id, restaurants(id, name, slug)')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (owner?.restaurants) return { restaurant: owner.restaurants, role: 'owner' };

  // Try staff link
  const { data: staff } = await supabase
    .from('telegram_staff_links')
    .select('staff_name, restaurants:restaurant_id(id, name, slug)')
    .eq('chat_id', chatId)
    .eq('active', true)
    .maybeSingle();
  if (staff?.restaurants) return { restaurant: staff.restaurants, role: 'staff', staff_name: staff.staff_name };

  return null;
}

async function handleReport(supabase: any, restaurantId: string, period: 'hoje' | 'semana' | 'mes'): Promise<string> {
  const since = new Date();
  if (period === 'hoje') since.setHours(0, 0, 0, 0);
  else if (period === 'semana') since.setDate(since.getDate() - 7);
  else since.setDate(since.getDate() - 30);

  const { data: orders } = await supabase
    .from('orders').select('total, status')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', since.toISOString());

  const valid = (orders || []).filter((o: any) => o.status !== 'cancelled');
  const count = valid.length;
  const revenue = valid.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const avg = count > 0 ? revenue / count : 0;

  return `📊 <b>Relatório — ${period.toUpperCase()}</b>\n\n🛒 Pedidos: <b>${count}</b>\n💰 Faturamento: <b>${fmt(revenue)}</b>\n🎯 Ticket médio: <b>${fmt(avg)}</b>`;
}

async function handleCommands(supabase: any, restaurantId: string): Promise<string> {
  const { data: tables } = await supabase
    .from('table_commands')
    .select('customer_name, restaurant_tables(number, label)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open');
  if (!tables || tables.length === 0) return '📋 Nenhuma comanda aberta no momento.';
  const lines = tables.map((c: any) => {
    const t = c.restaurant_tables;
    return `• ${t?.label || `Mesa ${t?.number}`} — ${c.customer_name}`;
  });
  return `📋 <b>Comandas abertas (${tables.length})</b>\n\n${lines.join('\n')}`;
}

async function handleStock(supabase: any, restaurantId: string): Promise<string> {
  const { data: items } = await supabase
    .from('inventory_items').select('name, current_stock, min_stock, unit')
    .eq('restaurant_id', restaurantId).eq('active', true);
  const low = (items || []).filter((i: any) => i.current_stock <= i.min_stock);
  if (low.length === 0) return '✅ Estoque em dia! Nenhum item abaixo do mínimo.';
  const lines = low.map((i: any) => `• <b>${i.name}</b>: ${i.current_stock} ${i.unit} (mín: ${i.min_stock})`);
  return `⚠️ <b>Itens em falta (${low.length})</b>\n\n${lines.join('\n')}`;
}

async function handleToggleOpen(supabase: any, restaurantId: string, open: boolean): Promise<string> {
  // Atualiza ambos: is_open (estado atual) e force_closed (trava o cron de horários)
  await supabase
    .from('restaurants')
    .update({ is_open: open, force_closed: !open } as any)
    .eq('id', restaurantId);
  return open
    ? '✅ Restaurante <b>aberto</b> manualmente.\n\nO cron de horários não vai fechar automaticamente. Use /fechar quando quiser encerrar.'
    : '🚫 Restaurante <b>fechado</b> manualmente.\n\nUse /abrir para reabrir.';
}

async function handleTables(supabase: any, restaurantId: string): Promise<string> {
  const { data: tables } = await supabase
    .from('restaurant_tables')
    .select('id, number, label, status')
    .eq('restaurant_id', restaurantId)
    .neq('status', 'inactive')
    .order('number');
  if (!tables || tables.length === 0) return '🪑 Nenhuma mesa cadastrada.';

  // Get open orders per table (today)
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { data: orders } = await supabase
    .from('orders').select('table_id, total, status')
    .eq('restaurant_id', restaurantId)
    .eq('type', 'dine_in')
    .gte('created_at', since.toISOString())
    .neq('status', 'cancelled');

  const totals: Record<string, number> = {};
  (orders || []).forEach((o: any) => {
    if (o.table_id) totals[o.table_id] = (totals[o.table_id] || 0) + Number(o.total || 0);
  });

  const lines = tables.map((t: any) => {
    const label = t.label || `Mesa ${t.number}`;
    const total = totals[t.id] || 0;
    const icon = total > 0 ? '🟢' : '⚪';
    return `${icon} ${label}${total > 0 ? ` — <b>${fmt(total)}</b>` : ''}`;
  });
  return `🪑 <b>Mesas (${tables.length})</b>\n\n${lines.join('\n')}`;
}

async function handleExpensesDue(supabase: any, restaurantId: string): Promise<string> {
  const today = new Date();
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const { data: exps } = await supabase
    .from('expenses')
    .select('description, amount, due_date, supplier')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', in7.toISOString().split('T')[0])
    .order('due_date');
  if (!exps || exps.length === 0) return '✅ Nenhuma despesa vencendo nos próximos 7 dias.';
  const total = exps.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const lines = exps.map((e: any) => {
    const d = new Date(e.due_date).toLocaleDateString('pt-BR');
    return `• ${d} — ${e.description}: <b>${fmt(e.amount)}</b>${e.supplier ? ` (${e.supplier})` : ''}`;
  });
  return `💸 <b>A vencer em 7 dias (${exps.length})</b>\n\n${lines.join('\n')}\n\n<b>Total: ${fmt(total)}</b>`;
}

async function handleGarcomLink(supabase: any, chatId: string, args: string): Promise<string> {
  // Format: /garcom <slug> <Nome Sobrenome>
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    return '❓ Uso: <code>/garcom slug-do-restaurante Seu Nome</code>';
  }
  const slug = parts[0].toLowerCase();
  const name = parts.slice(1).join(' ');

  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name').eq('slug', slug).single();
  if (!restaurant) return `❌ Restaurante "<b>${slug}</b>" não encontrado.`;

  const { error } = await supabase.from('telegram_staff_links').upsert(
    { restaurant_id: restaurant.id, chat_id: chatId, staff_name: name, active: true } as any,
    { onConflict: 'restaurant_id,chat_id' }
  );
  if (error) return `❌ Erro ao vincular: ${error.message}`;

  return `✅ <b>Vinculado como garçom!</b>\n🏪 ${restaurant.name}\n👤 ${name}\n\nVocê receberá chamadas de mesa em tempo real.\n\nUse /sair para desvincular.`;
}

async function handleGarcomLeave(supabase: any, chatId: string): Promise<string> {
  const { data } = await supabase
    .from('telegram_staff_links')
    .update({ active: false } as any)
    .eq('chat_id', chatId)
    .select('staff_name');
  if (!data || data.length === 0) return '⚠️ Você não está vinculado como garçom.';
  return '👋 Desvinculado. Você não receberá mais chamadas.';
}

async function handleAcceptOrder(supabase: any, orderId: string): Promise<string> {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'accepted' } as any)
    .eq('id', orderId)
    .eq('status', 'new');
  if (error) return `❌ Erro: ${error.message}`;
  return '✅ Pedido aceito! Foi para preparo.';
}

async function handleRejectOrder(supabase: any, orderId: string): Promise<string> {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' } as any)
    .eq('id', orderId);
  if (error) return `❌ Erro: ${error.message}`;
  return '❌ Pedido recusado.';
}

async function handleCompleteCall(supabase: any, callId: string): Promise<string> {
  const { error } = await supabase
    .from('waiter_calls')
    .update({ status: 'completed', completed_at: new Date().toISOString() } as any)
    .eq('id', callId);
  if (error) return `❌ Erro: ${error.message}`;
  return '✅ Chamada atendida.';
}

async function handlePauseNotify(supabase: any, customerId: string, chatId: string): Promise<string> {
  const { error } = await supabase
    .from('customer_telegram_links')
    .update({ notify_status_updates: false } as any)
    .eq('customer_id', customerId)
    .eq('chat_id', chatId)
    .eq('status', 'active');
  if (error) return `❌ Erro: ${error.message}`;
  return '🔕 Avisos pausados. Reative em Cliente > Perfil.';
}

async function handleUnlinkCustomer(supabase: any, customerId: string, chatId: string): Promise<string> {
  const { error } = await supabase
    .from('customer_telegram_links')
    .update({ status: 'revoked' } as any)
    .eq('customer_id', customerId)
    .eq('chat_id', chatId);
  if (error) return `❌ Erro: ${error.message}`;
  return '🚫 Telegram desvinculado deste pedido.';
}

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: offsetRow } = await supabase
      .from('platform_settings').select('value').eq('key', 'telegram_update_offset').single();
    const offset = offsetRow?.value ? parseInt(offsetRow.value) : 0;

    // timeout: 0 = short polling — avoids 409 conflicts when cron overlaps
    const response = await tg('getUpdates',
      { offset, timeout: 0, allowed_updates: ['message', 'callback_query'] },
      LOVABLE_API_KEY, TELEGRAM_API_KEY);

    // Soft-fail on gateway errors (5xx or non-JSON): log and return 200 with 0 processed
    // so the cron poller doesn't spam 500s during upstream gateway hiccups.
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    if (!response.ok || !contentType.includes('application/json')) {
      console.warn(`telegram getUpdates soft-fail [${response.status}] ct=${contentType} body=${rawBody.slice(0, 200)}`);
      return new Response(JSON.stringify({ ok: true, processed: 0, soft_fail: true, status: response.status }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let data: any;
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      console.warn(`telegram getUpdates JSON parse fail: ${rawBody.slice(0, 200)}`);
      return new Response(JSON.stringify({ ok: true, processed: 0, soft_fail: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates = data.result || [];
    let processed = 0;


    for (const update of updates) {
      // ============ CALLBACK QUERIES (inline buttons) ============
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbId = cb.id;
        const chatId = String(cb.message.chat.id);
        const messageId = cb.message.message_id;
        const dataStr = cb.data || '';
        const [action, id] = dataStr.split(':');

        let result = '';
        let suffix = '';

        if (action === 'accept_order') {
          result = await handleAcceptOrder(supabase, id);
          suffix = '\n\n<i>✅ Aceito por ' + (cb.from.first_name || 'usuário') + '</i>';
        } else if (action === 'reject_order') {
          result = await handleRejectOrder(supabase, id);
          suffix = '\n\n<i>❌ Recusado por ' + (cb.from.first_name || 'usuário') + '</i>';
        } else if (action === 'done_call') {
          result = await handleCompleteCall(supabase, id);
          suffix = '\n\n<i>✅ Atendido por ' + (cb.from.first_name || 'usuário') + '</i>';
        } else if (action === 'pause_notify') {
          result = await handlePauseNotify(supabase, id, chatId);
          suffix = '\n\n<i>🔕 Avisos pausados</i>';
        } else if (action === 'unlink_customer') {
          result = await handleUnlinkCustomer(supabase, id, chatId);
          suffix = '\n\n<i>🚫 Desvinculado</i>';
        } else {
          result = '❓ Ação desconhecida';
        }

        await answerCallback(cbId, result, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        if (suffix) {
          await editMessage(chatId, messageId, (cb.message.text || '') + suffix, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
        processed++;
        continue;
      }

      // ============ TEXT MESSAGES ============
      const msg = update.message;
      if (!msg?.text) continue;

      const text = msg.text.trim();
      const chatId = String(msg.chat.id);
      const lower = text.toLowerCase();

      // /start <token> — customer link via deep link (token starts with c_)
      if (text.startsWith('/start c_')) {
        const token = text.replace('/start ', '').trim();
        const { data: link } = await supabase
          .from('customer_telegram_links')
          .select('id, customer_id, status, customers(name, restaurant_id, restaurants(name))')
          .eq('link_token', token)
          .maybeSingle();

        if (!link) {
          await sendMessage(chatId, `❌ Link inválido ou expirado.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        } else if (link.status === 'revoked') {
          await sendMessage(chatId, `🚫 Este link foi revogado.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        } else {
          await supabase.from('customer_telegram_links')
            .update({ chat_id: chatId, status: 'active', linked_at: new Date().toISOString() } as any)
            .eq('id', link.id);
          const c: any = link.customers;
          const restName = c?.restaurants?.name || 'o restaurante';
          await sendMessage(chatId,
            `✅ <b>Telegram vinculado!</b>\n\nOlá, ${c?.name || 'cliente'}! 👋\n\nA partir de agora você recebe atualizações dos seus pedidos em <b>${restName}</b> aqui no Telegram automaticamente.\n\n🔔 Você será avisado quando:\n• Pedido for aceito\n• Estiver em preparo\n• Sair para entrega\n• Estiver pronto`,
            LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
        processed++; continue;
      }

      // /start <slug> — link OWNER
      if (text.startsWith('/start ')) {
        const slug = text.replace('/start ', '').trim().toLowerCase();
        const { data: restaurant } = await supabase
          .from('restaurants').select('id, name').eq('slug', slug).single();
        if (restaurant) {
          await supabase.from('restaurant_settings')
            .update({ telegram_chat_id: chatId } as any).eq('restaurant_id', restaurant.id);
          await sendMessage(chatId,
            `✅ <b>Vinculado como dono!</b>\n🏪 <b>${restaurant.name}</b>\n\n📋 <b>Comandos:</b>\n/relatorio_hoje /relatorio_semana /relatorio_mes\n/comandas /mesas /estoque /despesas\n/abrir /fechar\n/promover &lt;mensagem&gt;\n/ajuda`,
            LOVABLE_API_KEY, TELEGRAM_API_KEY);
        } else {
          await sendMessage(chatId, `❌ Restaurante "<b>${slug}</b>" não encontrado.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
        processed++; continue;
      }

      if (text === '/start') {
        await sendMessage(chatId,
          `👋 <b>Bem-vindo!</b>\n\n<b>Sou dono:</b> <code>/start meu-slug</code>\n<b>Sou garçom:</b> <code>/garcom meu-slug Seu Nome</code>`,
          LOVABLE_API_KEY, TELEGRAM_API_KEY);
        processed++; continue;
      }

      // /garcom <slug> <nome> — link STAFF
      if (lower.startsWith('/garcom ')) {
        const reply = await handleGarcomLink(supabase, chatId, text.replace(/^\/garcom\s+/i, ''));
        await sendMessage(chatId, reply, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        processed++; continue;
      }

      if (lower === '/sair') {
        const reply = await handleGarcomLeave(supabase, chatId);
        await sendMessage(chatId, reply, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        processed++; continue;
      }

      // All other commands require linked chat
      const link = await findRestaurantByChat(supabase, chatId);
      if (!link) {
        if (lower.startsWith('/')) {
          await sendMessage(chatId,
            `⚠️ Chat não vinculado. Use <code>/start seu-slug</code> (dono) ou <code>/garcom seu-slug Seu Nome</code>.`,
            LOVABLE_API_KEY, TELEGRAM_API_KEY);
          processed++;
        }
        continue;
      }

      const rId = link.restaurant.id;
      let reply: string | null = null;

      // /promover <texto> — broadcast to all linked customers (owner only)
      if (lower.startsWith('/promover ') && link.role === 'owner') {
        const promoText = text.replace(/^\/promover\s+/i, '').trim();
        if (promoText.length < 3) {
          reply = '❓ Use: <code>/promover Sua mensagem promocional aqui</code>';
        } else {
          // Count audience first
          const { data: customers } = await supabase
            .from('customers').select('id').eq('restaurant_id', rId);
          const ids = (customers || []).map((c: any) => c.id);
          let audience = 0;
          if (ids.length > 0) {
            const { count } = await supabase
              .from('customer_telegram_links')
              .select('id', { count: 'exact', head: true })
              .in('customer_id', ids)
              .eq('status', 'active')
              .eq('notify_status_updates', true);
            audience = count || 0;
          }
          if (audience === 0) {
            reply = '⚠️ Nenhum cliente vinculado ao Telegram ainda.';
          } else {
            // Fire the broadcast event
            await supabase.functions.invoke('telegram-notify', {
              body: {
                restaurant_id: rId,
                event_type: 'broadcast_promo',
                payload: { restaurant_name: link.restaurant.name, message: promoText },
              },
            });
            reply = `✅ <b>Promoção enviada!</b>\n📣 Para <b>${audience}</b> cliente(s) vinculado(s).`;
          }
        }
      }
      else if (lower === '/relatorio_hoje' || lower === '/relatorio') reply = await handleReport(supabase, rId, 'hoje');
      else if (lower === '/relatorio_semana') reply = await handleReport(supabase, rId, 'semana');
      else if (lower === '/relatorio_mes') reply = await handleReport(supabase, rId, 'mes');
      else if (lower === '/comandas') reply = await handleCommands(supabase, rId);
      else if (lower === '/mesas') reply = await handleTables(supabase, rId);
      else if (lower === '/estoque') reply = await handleStock(supabase, rId);
      else if (lower === '/despesas' && link.role === 'owner') reply = await handleExpensesDue(supabase, rId);
      else if (lower === '/abrir' && link.role === 'owner') reply = await handleToggleOpen(supabase, rId, true);
      else if (lower === '/fechar' && link.role === 'owner') reply = await handleToggleOpen(supabase, rId, false);
      else if (lower === '/meugarcom' && link.role === 'staff') {
        reply = `👤 <b>${link.staff_name}</b>\n🏪 ${link.restaurant.name}\n\nUse /sair para desvincular.`;
      }
      else if (lower === '/ajuda' || lower === '/help') {
        reply = link.role === 'owner'
          ? `📋 <b>Dono:</b>\n/relatorio_hoje /_semana /_mes\n/comandas /mesas /estoque /despesas\n/abrir /fechar\n/promover &lt;mensagem&gt;`
          : `📋 <b>Garçom:</b>\n/comandas /mesas /estoque\n/meugarcom /sair\n\nVocê recebe chamadas de mesa automaticamente.`;
      }
      else if (lower.startsWith('/')) {
        reply = `❓ Comando não reconhecido. Use /ajuda.`;
      }

      if (reply) {
        await sendMessage(chatId, reply, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        processed++;
      }
    }

    if (updates.length > 0) {
      const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
      await supabase.from('platform_settings')
        .upsert({ key: 'telegram_update_offset', value: String(newOffset) }, { onConflict: 'key' });
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('telegram-auto-link error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
