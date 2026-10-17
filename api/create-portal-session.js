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
    const { restaurantId, returnUrl, environment } = req.body || {};
    const env = environment || 'sandbox';

    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('restaurant_id', restaurantId)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: 'Nenhum cadastro de faturamento Stripe encontrado para este restaurante.' });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY;
    if (!stripeSecretKey) {
      return res.status(400).json({ error: 'Portal Stripe indisponível no momento.' });
    }

    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(stripeSecretKey);

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(returnUrl && { return_url: returnUrl }),
    });

    return res.status(200).json({ url: portal.url });
  } catch (err) {
    console.error('[create-portal-session] Error:', err);
    return res.status(500).json({ error: err.message || 'Erro ao gerar sessão do portal' });
  }
}
