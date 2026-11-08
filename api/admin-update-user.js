import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ynxrtjvyeymbiifehenk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.warn('[admin-update-user] SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente.');
}

const adminClient = SUPABASE_SERVICE_KEY
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
    return res.status(500).json({ error: 'Chave de serviço Supabase não configurada no servidor.' });
  }

  // 1. Validar autenticação do chamador via Bearer token
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado. Token de autorização ausente.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  // 2. Validar que o usuário é super_admin
  const callerId = userData.user.id;
  const { data: roleRow, error: roleErr } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', callerId)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (roleErr || !roleRow) {
    return res.status(403).json({ error: 'Acesso negado. Apenas super administradores podem executar esta operação.' });
  }

  try {
    const { action, user_id, email, password, full_name } = req.body || {};

    // 1. Create user directly with email_confirm: true (avoids email rate limits)
    if (action === 'create-user') {
      if (!email || !password) {
        return res.status(400).json({ error: 'email e password são obrigatórios' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || '' }
      });

      if (createErr) {
        // If user already exists, retrieve them
        const { data: listRes } = await adminClient.auth.admin.listUsers();
        const found = listRes?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
        if (found) {
          return res.status(200).json({ success: true, user: found });
        }
        return res.status(400).json({ error: createErr.message });
      }

      return res.status(200).json({ success: true, user: newUser?.user });
    }

    // 2. Get user by email
    if (action === 'get-by-email') {
      if (!email) return res.status(400).json({ error: 'email é obrigatório' });
      const cleanEmail = email.trim().toLowerCase();
      const { data: listRes, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) return res.status(400).json({ error: listErr.message });
      const found = listRes?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
      if (!found) return res.status(404).json({ error: 'Usuário não encontrado', user: null });
      return res.status(200).json({ user: { id: found.id, email: found.email } });
    }

    // 3. Delete user
    if (action === 'delete-user') {
      if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });
      const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (delErr) return res.status(400).json({ error: delErr.message });
      return res.status(200).json({ success: true });
    }

    // 4. Safe restaurant owner credentials management
    if (action === 'set-restaurant-owner') {
      const { restaurant_id } = req.body || {};
      if (!restaurant_id) {
        return res.status(400).json({ error: 'restaurant_id é obrigatório' });
      }

      const { data: rest, error: restErr } = await adminClient
        .from('restaurants')
        .select('id, name, email, owner_id')
        .eq('id', restaurant_id)
        .single();

      if (restErr || !rest) {
        return res.status(404).json({ error: 'Restaurante não encontrado' });
      }

      const cleanEmail = email ? email.trim().toLowerCase() : (rest.email || '').trim().toLowerCase();
      if (!cleanEmail && !user_id) {
        return res.status(400).json({ error: 'E-mail do proprietário é obrigatório' });
      }

      let targetUserId = rest.owner_id;
      const isOwnerSuperAdmin = targetUserId === callerId;
      const needsNewOrSeparateAccount = !targetUserId || isOwnerSuperAdmin || (email && cleanEmail !== (rest.email || '').toLowerCase());

      if (needsNewOrSeparateAccount) {
        let foundUser = null;
        if (cleanEmail) {
          const { data: listRes } = await adminClient.auth.admin.listUsers();
          foundUser = listRes?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
        }

        if (foundUser) {
          targetUserId = foundUser.id;
          if (password) {
            await adminClient.auth.admin.updateUserById(targetUserId, { password });
          }
        } else {
          if (!cleanEmail) {
            return res.status(400).json({ error: 'Informe um e-mail válido para o proprietário' });
          }
          const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
            email: cleanEmail,
            password: password || '12345678',
            email_confirm: true,
            user_metadata: { full_name: full_name || rest.name },
          });

          if (createErr) {
            return res.status(400).json({ error: createErr.message });
          }
          targetUserId = created.user.id;
        }

        await adminClient
          .from('restaurants')
          .update({
            owner_id: targetUserId,
            ...(cleanEmail ? { email: cleanEmail } : {}),
          })
          .eq('id', restaurant_id);

        const { data: existingRole } = await adminClient
          .from('user_roles')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('restaurant_id', restaurant_id)
          .eq('role', 'owner')
          .maybeSingle();

        if (!existingRole) {
          await adminClient.from('user_roles').insert({
            user_id: targetUserId,
            restaurant_id,
            role: 'owner',
          });
        }

        if (isOwnerSuperAdmin && targetUserId !== callerId) {
          await adminClient
            .from('user_roles')
            .delete()
            .eq('user_id', callerId)
            .eq('restaurant_id', restaurant_id)
            .eq('role', 'owner');
        }

        const { data: profile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (!profile) {
          await adminClient.from('profiles').insert({
            user_id: targetUserId,
            full_name: full_name || rest.name,
          });
        }

        return res.status(200).json({
          success: true,
          owner_id: targetUserId,
          email: cleanEmail,
          message: 'Proprietário atualizado e vinculado ao restaurante.',
        });
      }

      // If already a separate user, update their credentials directly
      const updates = {};
      if (email) {
        updates.email = cleanEmail;
        updates.email_confirm = true;
      }
      if (password) updates.password = password;

      if (Object.keys(updates).length > 0) {
        const { data: updated, error: updErr } = await adminClient.auth.admin.updateUserById(targetUserId, updates);
        if (updErr) return res.status(400).json({ error: updErr.message });
      }

      if (cleanEmail) {
        await adminClient.from('restaurants').update({ email: cleanEmail }).eq('id', restaurant_id);
      }

      return res.status(200).json({
        success: true,
        owner_id: targetUserId,
        email: cleanEmail || rest.email,
        message: 'Credenciais atualizadas com sucesso.',
      });
    }

    // 5. Default: Update user
    if (!user_id) {
      return res.status(400).json({ error: 'user_id é obrigatório' });
    }

    const updates = {};
    if (email) {
      updates.email = email.trim().toLowerCase();
      updates.email_confirm = true;
    }
    if (password) updates.password = password;

    const { data: updated, error: updErr } = await adminClient.auth.admin.updateUserById(user_id, updates);
    if (updErr) return res.status(400).json({ error: updErr.message });

    return res.status(200).json({ success: true, user: { id: updated.user.id, email: updated.user.email } });
  } catch (err) {
    console.error('[admin-update-user] Error:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
}
