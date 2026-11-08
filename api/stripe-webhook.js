import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const admin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

// Disable body parsing in Vercel for raw webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!admin) {
    return res.status(500).json({ error: 'Supabase service não configurado.' });
  }

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    // 1. Obter Stripe Secret Key e Webhook Secret
    let stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      const { data: settings } = await admin
        .from('platform_settings')
        .select('key, value')
        .in('key', ['stripe_secret_key', 'stripe_webhook_secret']);
      
      settings?.forEach(s => {
        if (s.key === 'stripe_secret_key' && !stripeSecretKey && s.value) {
          stripeSecretKey = String(s.value).trim();
        }
        if (s.key === 'stripe_webhook_secret' && !webhookSecret && s.value) {
          webhookSecret = String(s.value).trim();
        }
      });
    }

    if (!stripeSecretKey) {
      console.error('[stripe-webhook] Nenhuma chave stripe_secret_key encontrada.');
      return res.status(500).json({ error: 'Stripe secret key não configurada.' });
    }

    const stripe = new Stripe(stripeSecretKey);
    let event;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err) {
        console.warn('[stripe-webhook] Assinatura do webhook inválida:', err.message);
        return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
      }
    } else {
      // Parse direto caso o webhook secret ainda não esteja cadastrado
      try {
        event = JSON.parse(rawBody.toString('utf8'));
      } catch (jsonErr) {
        return res.status(400).send('Corpo do evento inválido');
      }
    }

    console.log('[stripe-webhook] Evento recebido:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const restaurantId = session.metadata?.restaurantId;
        if (restaurantId) {
          await admin.from('subscriptions').update({
            status: 'active',
            trial_ends_at: null,
            stripe_customer_id: session.customer || null,
            stripe_subscription_id: session.subscription || null,
            current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('restaurant_id', restaurantId);

          await admin.from('restaurants').update({
            status: 'active'
          }).eq('id', restaurantId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const restaurantId = sub.metadata?.restaurantId;
        if (restaurantId) {
          const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
          await admin.from('subscriptions').update({
            status,
            trial_ends_at: sub.status === 'trialing' && sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : new Date().toISOString(),
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer || null,
            updated_at: new Date().toISOString(),
          }).eq('restaurant_id', restaurantId);

          if (status === 'active') {
            await admin.from('restaurants').update({ status: 'active' }).eq('id', restaurantId);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const restaurantId = sub.metadata?.restaurantId;
        if (restaurantId) {
          await admin.from('subscriptions').update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          }).eq('restaurant_id', restaurantId);

          await admin.from('restaurants').update({ status: 'cancelled' }).eq('id', restaurantId);
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const restaurantId = invoice.subscription_details?.metadata?.restaurantId || invoice.metadata?.restaurantId;
        if (restaurantId) {
          // Busca a assinatura correspondente no banco
          const { data: subRow } = await admin
            .from('subscriptions')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (subRow?.id) {
            await admin.from('subscription_payments').insert({
              restaurant_id: restaurantId,
              subscription_id: subRow.id,
              amount: (invoice.amount_paid || 0) / 100,
              status: 'approved',
              payment_method: 'stripe',
              stripe_invoice_id: invoice.id || null,
              stripe_payment_intent_id: invoice.payment_intent || null,
              stripe_subscription_id: invoice.subscription || null,
              paid_at: invoice.status_transitions?.paid_at
                ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
                : new Date().toISOString(),
            });
          }
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Evento ignorado: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] Erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
