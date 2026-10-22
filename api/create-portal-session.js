import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

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
    return res.status(500).json({ error: 'Configuração do servidor de autenticação incompleta.' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    const { restaurantId, returnUrl, environment } = req.body || {};
    if (!restaurantId) {
      return res.status(400).json({ error: 'ID do restaurante não informado.' });
    }
    const env = environment || 'sandbox';

    // Authorization check: Caller must be super_admin or restaurant owner/manager
    const { data: superAdminRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!superAdminRole) {
      const { data: restRole } = await admin
        .from('restaurant_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .in('role', ['owner', 'manager'])
        .maybeSingle();

      if (!restRole) {
        const { data: restOwner } = await admin
          .from('restaurants')
          .select('id')
          .eq('id', restaurantId)
          .eq('owner_id', user.id)
          .maybeSingle();

        if (!restOwner) {
          return res.status(403).json({ error: 'Você não tem permissão para gerenciar a assinatura deste restaurante.' });
        }
      }
    }

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
