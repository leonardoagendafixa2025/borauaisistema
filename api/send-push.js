import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BJOZteu5NRKarKGeaue3DpKROnNvf90eviVFKCUn0eq-ZtCekAfRRnOGfYBk8y29Y6JyqO2kUaZDBc1bCPdTjag';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'b7p7vyy2HlmcmWzZ91na780C18tcFONv8c6DrMyBfQY';
const VAPID_SUBJECT = 'mailto:contato@borauai.com';

const GUEST_USER_ID = 'd1ac7098-2af3-4c5a-9d22-d1ebdef6db2a';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function formatCurrency(val) {
  const n = Number(val) || 0;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

/** Formata notificações automáticas vindas de triggers de banco ou eventos operacionais */
function buildEventNotification(eventType, payload) {
  const p = payload || {};
  switch (eventType) {
    case 'new_order': {
      const typeLabel = p.type === 'delivery' ? 'Entrega 🛵' : p.type === 'pickup' ? 'Retirada 🛍️' : 'Mesa 🍽️';
      const totalStr = p.total ? ` • ${formatCurrency(p.total)}` : '';
      return {
        title: `🆕 Novo Pedido #${p.number || ''}`,
        body: `${p.customer_name || 'Cliente'} • ${typeLabel}${totalStr}`,
        url: '/garcom',
        tag: `order-${p.order_id || Date.now()}`,
        vibrate: [300, 100, 300, 100, 400],
        requireInteraction: true,
        actions: [{ action: 'open', title: '👀 Ver Pedido' }]
      };
    }
    case 'waiter_call': {
      const isBill = p.type === 'request_bill';
      const tableText = p.table_label || (p.table_number ? `Mesa ${p.table_number}` : 'Mesa');
      return {
        title: isBill ? '💰 Pedido de Conta' : '🔔 Chamada de Garçom',
        body: `${tableText} precisa de atendimento!${p.message ? ` — ${p.message}` : ''}`,
        url: '/garcom',
        tag: `call-${p.call_id || Date.now()}`,
        vibrate: [400, 150, 400, 150, 400],
        requireInteraction: true,
        actions: [{ action: 'open', title: isBill ? '💵 Levar Conta' : '🏃 Atender Mesa' }]
      };
    }
    case 'music_request': {
      return {
        title: '🎵 Pedido de Música',
        body: `${p.song || 'Música pendente'} • ${p.table_label || 'Mesa'}${p.customer_name ? ` (${p.customer_name})` : ''}`,
        url: '/restaurant/dj',
        tag: `music-${p.request_id || Date.now()}`,
        vibrate: [200, 100, 200, 100, 200],
        actions: [{ action: 'open', title: '🎶 Ver Fila DJ' }]
      };
    }
    case 'order_status': {
      const statusMap = {
        preparing: '👨‍🍳 Pedido sendo preparado!',
        out_for_delivery: '🛵 Pedido saiu para entrega!',
        ready: '✅ Pedido pronto para retirada!',
        completed: '🎉 Pedido entregue! Bom apetite!'
      };
      return {
        title: statusMap[p.status] || '📦 Atualização do Pedido',
        body: p.message || `O status do seu pedido #${p.number || ''} foi atualizado.`,
        url: p.order_id ? `/pedido/${p.order_id}` : '/meus-pedidos',
        tag: `order-status-${p.order_id || Date.now()}`,
        vibrate: [200, 100, 200],
        actions: [{ action: 'open', title: '👀 Ver Status' }]
      };
    }
    default:
      return null;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bodyData = req.body || {};
    const { action } = bodyData;

    // ========================================================
    // AÇÃO 1: Inscrição de Aparelho (Suporta Usuários e Visitantes)
    // ========================================================
    if (action === 'subscribe') {
      const {
        endpoint,
        p256dh,
        auth,
        user_id,
        restaurant_id,
        device_label,
        user_agent
      } = bodyData;

      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: 'Dados da subscription inválidos.' });
      }

      const effectiveUserId = user_id || GUEST_USER_ID;

      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: effectiveUserId,
            restaurant_id: restaurant_id || null,
            endpoint,
            p256dh,
            auth,
            user_agent: (user_agent || '').slice(0, 200),
            device_label: device_label || 'Browser',
            last_seen_at: new Date().toISOString()
          },
          { onConflict: 'endpoint' }
        )
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar push_subscription:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, subscription: data });
    }

    // ========================================================
    // AÇÃO 2: Cancelamento de Inscrição
    // ========================================================
    if (action === 'unsubscribe') {
      const { endpoint } = bodyData;
      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint não fornecido.' });
      }

      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      return res.status(200).json({ success: true });
    }

    // ========================================================
    // AÇÃO 3: Disparo de Notificação Push
    // ========================================================
    let {
      title,
      body,
      url,
      image,
      icon,
      restaurant_id,
      tag,
      vibrate,
      actions,
      event_type,
      payload
    } = bodyData;

    if (!supabase) {
      return res.status(500).json({ error: 'Serviço de push indisponível (credenciais não configuradas).' });
    }

    // Se recebido via trigger de evento (DB trigger ou webhook)
    if (event_type) {
      if (!restaurant_id) {
        return res.status(400).json({ error: 'Eventos operacionais exigem restaurant_id.' });
      }
      const generated = buildEventNotification(event_type, payload);
      if (generated) {
        title = title || generated.title;
        body = body || generated.body;
        url = url || generated.url;
        tag = tag || generated.tag;
        vibrate = vibrate || generated.vibrate;
        actions = actions || generated.actions;
      }
    } else {
      // Disparo manual (Broadcast Master / Campanha): Exige autenticação de super_admin
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) {
        return res.status(401).json({ error: 'Disparo de campanha exige autenticação de super_admin.' });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      }

      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (!roleCheck) {
        return res.status(403).json({ error: 'Apenas super administradores podem disparar campanhas de push.' });
      }
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
    }

    // 1. Busca os aparelhos registrados
    let query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth, restaurant_id');
    if (restaurant_id) {
      query = query.eq('restaurant_id', restaurant_id);
    }

    const { data: subs, error: subsError } = await query;
    if (subsError) {
      console.error('Erro ao buscar push_subscriptions:', subsError);
      return res.status(500).json({ error: subsError.message });
    }

    const total = subs?.length || 0;

    // Se não houver aparelhos inscritos ainda
    if (total === 0) {
      // Registra no histórico de broadcasts se for disparo do Master
      if (!event_type) {
        await supabase.from('master_broadcasts').insert({
          channel: 'push',
          subject: title,
          body,
          segment: { restaurant_id: restaurant_id || null, url: url || '/', image },
          total_recipients: 0,
          sent_count: 0,
          failed_count: 0,
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      }

      return res.status(200).json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Nenhum dispositivo inscrito para este segmento no momento.'
      });
    }

    // 2. Monta o payload do Web Push (estilo nativo Android / Shopee / iFood)
    const pushPayload = JSON.stringify({
      title,
      body,
      icon: icon || '/pwa-192.png',
      badge: '/favicon.png',
      image: image || undefined,
      url: url || '/',
      tag: tag || `borauai-${Date.now()}`,
      vibrate: vibrate || [300, 100, 300, 100, 400],
      requireInteraction: true,
      actions: actions || [
        { action: 'open', title: '👀 Ver Agora' }
      ]
    });

    let sent = 0;
    let failed = 0;
    const expiredIds = [];

    // 3. Dispara em paralelo para todos os aparelhos
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: {
                p256dh: s.p256dh,
                auth: s.auth
              }
            },
            pushPayload,
            {
              TTL: 86400, // 24 horas no Google FCM
              urgency: 'high' // Acorda o Android imediatamente
            }
          );
          sent++;
        } catch (err) {
          failed++;
          // Se o aparelho desinstalou ou a permissão expirou (404 ou 410)
          if (err.statusCode === 404 || err.statusCode === 410) {
            expiredIds.push(s.id);
          } else {
            console.warn('[push-error]', s.endpoint, err.statusCode, err.message);
          }
        }
      })
    );

    // 4. Limpa aparelhos expirados
    if (expiredIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds);
    }

    // 5. Salva no histórico de broadcasts se for disparo de campanha
    if (!event_type) {
      await supabase.from('master_broadcasts').insert({
        channel: 'push',
        subject: title,
        body,
        segment: { restaurant_id: restaurant_id || null, url: url || '/', image },
        total_recipients: total,
        sent_count: sent,
        failed_count: failed,
        status: failed === total && total > 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      sent,
      failed,
      total,
      cleanedExpired: expiredIds.length
    });
  } catch (error) {
    console.error('Fatal send-push error:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao disparar push' });
  }
}
