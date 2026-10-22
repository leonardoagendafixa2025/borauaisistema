import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.warn('[create-checkout] SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente.');
}

const admin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;


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

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Servidor de pagamentos não configurado.' });
  }

  // 1. Validar autenticação do chamador
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado. Faça login para continuar.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  const callerId = userData.user.id;

  try {
    const { priceId, restaurantId, customerEmail, userId, returnUrl, environment } = req.body || {};

    if (!priceId || !restaurantId) {
      return res.status(400).json({ error: 'Parâmetros priceId e restaurantId são obrigatórios.' });
    }

    // 2. Validar que o usuário é dono/gerente do restaurante ou super_admin
    const { data: roleCheck } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .or(`restaurant_id.eq.${restaurantId},role.eq.super_admin`);

    const hasPermission = roleCheck && roleCheck.some(r => ['owner', 'manager', 'super_admin'].includes(r.role));
    if (!hasPermission) {
      // Fallback: checar se é owner_id na tabela restaurants
      const { data: restCheck } = await admin
        .from('restaurants')
        .select('id')
        .eq('id', restaurantId)
        .eq('owner_id', callerId)
        .maybeSingle();

      if (!restCheck) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o responsável pelo restaurante pode gerenciar o plano.' });
      }
    }

    const env = environment || 'sandbox';

    // 3. Resolve plan from database
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
          const targetEmail = customerEmail || userData.user.email;
          if (targetEmail) {
            const existingCust = await stripe.customers.list({ email: targetEmail, limit: 1 });
            if (existingCust.data.length > 0) {
              customerId = existingCust.data[0].id;
            }
          }
          if (!customerId) {
            const newCust = await stripe.customers.create({
              ...(targetEmail && { email: targetEmail }),
              metadata: { restaurantId, userId: callerId }
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
              metadata: { restaurantId, userId: callerId }
            });
            return res.status(200).json({ switched: true });
          }

          const session = await stripe.checkout.sessions.create({
            line_items: [{ price: stripePrice.id, quantity: 1 }],
            mode: 'subscription',
            ui_mode: 'embedded_page',
            return_url: returnUrl || `${req.headers.origin || ''}/restaurant/billing/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            customer: customerId,
            metadata: { restaurantId, userId: callerId },
            subscription_data: { metadata: { restaurantId, userId: callerId } }
          });

          return res.status(200).json({ clientSecret: session.client_secret });
        }
      } catch (stripeErr) {
        console.error('[create-checkout] Erro Stripe:', stripeErr.message);
        return res.status(502).json({ error: `Erro no gateway de pagamento: ${stripeErr.message}` });
      }
    }

    return res.status(503).json({
      error: 'Gateway de pagamento Stripe não configurado no servidor. Configure a chave STRIPE_SECRET_KEY para ativar assinaturas comerciais.'
    });
  } catch (err) {
    console.error('[create-checkout] Error:', err);
    return res.status(500).json({ error: err.message || 'Erro ao processar assinatura' });
  }
}
