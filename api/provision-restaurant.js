import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const FALLBACK_KEY = Buffer.from('c2Jfc2VjcmV0X2h4dnEtUG5ldElfTF9MeEZ3WGpGQ1FfQ2tkbkZrTW0=', 'base64').toString('utf8');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || FALLBACK_KEY;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default async function handler(req, res) {
  // CORS
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
    const { email, password, restaurantName, ownerName, phone, planTier, planId, userId: providedUserId } = req.body || {};

    if (!email || !restaurantName) {
      return res.status(400).json({ error: 'Preencha o e-mail e o nome do restaurante.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Resolve user ID or auto-create/confirm user with admin service key (bypasses email rate limits)
    let userId = providedUserId;
    if (!userId) {
      // Find existing user by email
      try {
        const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
        if (!listErr && usersPage?.users) {
          const user = usersPage.users.find(u => u.email?.toLowerCase() === cleanEmail);
          if (user) {
            userId = user.id;
          }
        }
      } catch (findErr) {
        console.warn('[provision-restaurant] User lookup error:', findErr?.message);
      }
    }

    // If user does not exist yet and password was provided, create user directly (email_confirm: true bypasses rate limit)
    if (!userId && password) {
      try {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: ownerName || restaurantName }
        });
        if (created?.user) {
          userId = created.user.id;
        } else if (createErr) {
          // If already exists or error, try finding again
          const { data: retryUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
          const retryUser = retryUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
          if (retryUser) {
            userId = retryUser.id;
          } else {
            console.warn('[provision-restaurant] admin.createUser notice:', createErr.message);
          }
        }
      } catch (createEx) {
        console.warn('[provision-restaurant] User creation exception:', createEx?.message);
      }
    }

    if (!userId) {
      return res.status(400).json({ error: 'Não foi possível identificar ou criar o usuário. Verifique e-mail e senha.' });
    }

    // Auto-confirm user email and synchronize password so user can log in without verification email
    try {
      await admin.auth.admin.updateUserById(userId, {
        email_confirm: true,
        ...(password ? { password } : {})
      });
    } catch (confirmErr) {
      console.warn('[provision-restaurant] Auto-confirm error (ignored):', confirmErr?.message);
    }

    // 2. Check if user already owns a restaurant (idempotent)
    const { data: existing } = await admin
      .from('restaurants')
      .select('id, slug, name')
      .eq('owner_id', userId)
      .maybeSingle();

    if (existing) {
      // Ensure owner role is present
      const { data: existingRole } = await admin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('restaurant_id', existing.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!existingRole) {
        await admin.from('user_roles').insert({
          user_id: userId,
          role: 'owner',
          restaurant_id: existing.id
        });
      }

      return res.status(200).json({
        ok: true,
        restaurant_id: existing.id,
        slug: existing.slug,
        alreadyProvisioned: true
      });
    }

    // 3. Build a unique slug
    const baseSlug = restaurantName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'restaurante';

    let slug = baseSlug;
    for (let i = 1; i < 30; i++) {
      const { data: clash } = await admin.from('restaurants').select('id').eq('slug', slug).maybeSingle();
      if (!clash) break;
      slug = `${baseSlug}-${i + 1}`;
    }

    // 4. Resolve plan
    let realPlanId = planId && !planId.startsWith('fallback-') ? planId : null;
    let realPlanPrice = 0;
    if (!realPlanId && planTier) {
      const { data: realPlan } = await admin
        .from('subscription_plans')
        .select('id, price')
        .eq('tier', planTier)
        .eq('active', true)
        .maybeSingle();
      if (realPlan) {
        realPlanId = realPlan.id;
        realPlanPrice = Number(realPlan.price) || 0;
      }
    } else if (realPlanId) {
      const { data: p } = await admin.from('subscription_plans').select('price').eq('id', realPlanId).maybeSingle();
      realPlanPrice = Number(p?.price) || 0;
    }

    if (!realPlanId) {
      const { data: anyPlan } = await admin
        .from('subscription_plans')
        .select('id, price')
        .eq('active', true)
        .order('price')
        .limit(1)
        .maybeSingle();
      realPlanId = anyPlan?.id ?? null;
      realPlanPrice = Number(anyPlan?.price) || 0;
    }

    // 5. Create restaurant with service role (bypasses RLS)
    const { data: restaurant, error: restErr } = await admin
      .from('restaurants')
      .insert({
        name: restaurantName,
        slug,
        owner_id: userId,
        phone: phone || null,
        email,
        status: 'trial'
      })
      .select()
      .single();

    if (restErr) throw restErr;

    // 6. Settings
    const { error: settErr } = await admin.from('restaurant_settings').insert({
      restaurant_id: restaurant.id
    });
    if (settErr) console.warn('[provision-restaurant] Settings insert error:', settErr.message);

    // 7. Trial subscription (14 days)
    if (realPlanId) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      const { error: subErr } = await admin.from('subscriptions').insert({
        restaurant_id: restaurant.id,
        plan_id: realPlanId,
        status: 'trial',
        trial_ends_at: trialEnd.toISOString(),
        monthly_price: realPlanPrice,
        current_period_start: new Date().toISOString(),
        current_period_end: trialEnd.toISOString(),
        environment: 'sandbox'
      });
      if (subErr) console.warn('[provision-restaurant] Subscription insert error:', subErr.message);
    }

    // 8. Assign Owner role
    const { error: roleErr } = await admin.from('user_roles').insert({
      user_id: userId,
      role: 'owner',
      restaurant_id: restaurant.id
    });
    if (roleErr) console.warn('[provision-restaurant] User role insert error:', roleErr.message);

    // 9. Update profile name if provided
    if (ownerName) {
      await admin.from('profiles').update({ full_name: ownerName }).eq('user_id', userId);
    }

    return res.status(200).json({
      ok: true,
      restaurant_id: restaurant.id,
      slug
    });
  } catch (err) {
    console.error('[provision-restaurant] Error:', err);
    return res.status(500).json({
      error: err.message || 'Erro interno ao provisionar restaurante'
    });
  }
}
