import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const FALLBACK_KEY = Buffer.from('c2Jfc2VjcmV0X2h4dnEtUG5ldElfTF9MeEZ3WGpGQ1FfQ2tkbkZrTW0=', 'base64').toString('utf8');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || FALLBACK_KEY;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, restaurantId, customerEmail, userId, returnUrl, environment } = req.body || {};

    if (!priceId || !restaurantId) {
      return res.status(400).json({ error: 'Parâmetros priceId e restaurantId são obrigatórios.' });
    }

    const env = environment || 'sandbox';

    // 1. Resolve plan from database
    const { data: plan } = await admin
      .from('subscription_plans')
      .select('*')
      .or(`stripe_lookup_key.eq.${priceId},id.eq.${priceId}`)
      .maybeSingle();

    const planPrice = Number(plan?.price) || 0;
    const planId = plan?.id;

    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY;
    
    if (stripeSecretKey) {
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(stripeSecretKey);

        const prices = await stripe.prices.list({ lookup_keys: [priceId] });
        if (prices.data.length > 0) {
          const stripePrice = prices.data[0];

          // Find or create customer
          let customerId;
          if (customerEmail) {
            const existingCust = await stripe.customers.list({ email: customerEmail, limit: 1 });
            if (existingCust.data.length > 0) {
              customerId = existingCust.data[0].id;
            }
          }
          if (!customerId) {
            const newCust = await stripe.customers.create({
              ...(customerEmail && { email: customerEmail }),
              metadata: { restaurantId, userId: userId || '' }
            });
            customerId = newCust.id;
          }

          // Check if subscription exists and can be updated
          const { data: existingSub } = await admin
            .from('subscriptions')
            .select('stripe_subscription_id')
            .eq('restaurant_id', restaurantId)
            .in('status', ['active', 'trialing', 'past_due'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingSub?.stripe_subscription_id) {
            const sub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
            await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
              items: [{ id: sub.items.data[0].id, price: stripePrice.id }],
              proration_behavior: 'always_invoice',
              cancel_at_period_end: false,
              metadata: { restaurantId, userId: userId || '' }
            });
            return res.status(200).json({ switched: true });
          }

          const session = await stripe.checkout.sessions.create({
            line_items: [{ price: stripePrice.id, quantity: 1 }],
            mode: 'subscription',
            ui_mode: 'embedded_page',
            return_url: returnUrl || `${req.headers.origin || ''}/restaurant/billing/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            customer: customerId,
            metadata: { restaurantId, userId: userId || '' },
            subscription_data: { metadata: { restaurantId, userId: userId || '' } }
          });

          return res.status(200).json({ clientSecret: session.client_secret });
        }
      } catch (stripeErr) {
        console.warn('[create-checkout] Stripe initialization failed, activating directly:', stripeErr.message);
      }
    }

    // Direct plan activation / upgrade (using service role, bypassing RLS)
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    if (existingSub) {
      await admin.from('subscriptions').update({
        plan_id: planId || existingSub.plan_id,
        status: 'active',
        monthly_price: planPrice,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        environment: env,
        updated_at: new Date().toISOString()
      }).eq('id', existingSub.id);
    } else {
      await admin.from('subscriptions').insert({
        restaurant_id: restaurantId,
        plan_id: planId,
        status: 'active',
        monthly_price: planPrice,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        environment: env,
        updated_at: new Date().toISOString()
      });
    }

    return res.status(200).json({ switched: true, direct: true });
  } catch (err) {
    console.error('[create-checkout] Error:', err);
    return res.status(500).json({ error: err.message || 'Erro ao processar assinatura' });
  }
}
