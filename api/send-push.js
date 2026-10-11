import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const FALLBACK_KEY = Buffer.from('c2Jfc2VjcmV0X2h4dnEtUG5ldElfTF9MeEZ3WGpGQ1FfQ2tkbkZrTW0=', 'base64').toString('utf8');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || FALLBACK_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BJOZteu5NRKarKGeaue3DpKROnNvf90eviVFKCUn0eq-ZtCekAfRRnOGfYBk8y29Y6JyqO2kUaZDBc1bCPdTjag';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'b7p7vyy2HlmcmWzZ91na780C18tcFONv8c6DrMyBfQY';
const VAPID_SUBJECT = 'mailto:contato@borauai.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
    const {
      title,
      body,
      url,
      image,
      icon,
      restaurant_id,
      tag,
      vibrate
    } = req.body || {};

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
      // Registra no histórico de broadcasts
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

      return res.status(200).json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Nenhum dispositivo inscrito no momento. Clique em "Inscrever meu celular" para receber notificações de teste!'
      });
    }

    // 2. Monta o payload do Web Push (estilo nativo Android / Shopee / iFood)
    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/pwa-192.png',
      badge: '/favicon.png',
      image: image || undefined, // Banner estilo Shopee/iFood
      url: url || '/',
      tag: tag || `borauai-${Date.now()}`,
      vibrate: vibrate || [300, 100, 300, 100, 400],
      requireInteraction: true,
      actions: [
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
            payload,
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

    // 5. Salva no histórico de broadcasts do Master
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
