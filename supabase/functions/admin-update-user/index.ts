import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify caller identity using getClaims
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = claimsData.claims.sub as string;

    // Verify super_admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", callerId).eq("role", "super_admin");
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action, user_id, email, password } = body;

    // Action: create user (admin directly, bypasses rate limit and auto-confirms email)
    if (action === "create-user") {
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "email e password são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanEmail = email.trim().toLowerCase();
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name || '' },
      });
      if (createErr) {
        const { data: listRes } = await adminClient.auth.admin.listUsers();
        const found = listRes?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
        if (found) {
          return new Response(JSON.stringify({ success: true, user: found }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, user: newUser?.user }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Action: get user by email
    if (action === "get-by-email") {
      if (!email) return new Response(JSON.stringify({ error: "email é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) return new Response(JSON.stringify({ error: listErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const found = users.find((u: any) => u.email === email);
      if (!found) return new Response(JSON.stringify({ error: "Usuário não encontrado", user: null }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ user: { id: found.id, email: found.email } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Action: delete user
    if (action === "delete-user") {
      if (!user_id) return new Response(JSON.stringify({ error: "user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Action: set restaurant owner credentials safely
    if (action === "set-restaurant-owner") {
      const { restaurant_id } = body;
      if (!restaurant_id) {
        return new Response(JSON.stringify({ error: "restaurant_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: rest, error: restErr } = await adminClient
        .from("restaurants")
        .select("id, name, email, owner_id")
        .eq("id", restaurant_id)
        .single();

      if (restErr || !rest) {
        return new Response(JSON.stringify({ error: "Restaurante não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cleanEmail = email ? email.trim().toLowerCase() : (rest.email || "").trim().toLowerCase();
      if (!cleanEmail && !user_id) {
        return new Response(JSON.stringify({ error: "E-mail do proprietário é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let targetUserId = rest.owner_id;
      const isOwnerSuperAdmin = targetUserId === callerId;
      const needsNewOrSeparateAccount = !targetUserId || isOwnerSuperAdmin || (email && cleanEmail !== (rest.email || "").toLowerCase());

      if (needsNewOrSeparateAccount) {
        let foundUser: any = null;
        if (cleanEmail) {
          const { data: listRes } = await adminClient.auth.admin.listUsers();
          foundUser = listRes?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
        }

        if (foundUser) {
          targetUserId = foundUser.id;
          if (password) {
            await adminClient.auth.admin.updateUserById(targetUserId, { password });
          }
        } else {
          if (!cleanEmail) {
            return new Response(JSON.stringify({ error: "Informe um e-mail válido para o proprietário" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
            email: cleanEmail,
            password: password || "12345678",
            email_confirm: true,
            user_metadata: { full_name: body.full_name || rest.name },
          });

          if (createErr) {
            return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          targetUserId = created.user.id;
        }

        await adminClient
          .from("restaurants")
          .update({
            owner_id: targetUserId,
            ...(cleanEmail ? { email: cleanEmail } : {}),
          })
          .eq("id", restaurant_id);

        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("restaurant_id", restaurant_id)
          .eq("role", "owner")
          .maybeSingle();

        if (!existingRole) {
          await adminClient.from("user_roles").insert({
            user_id: targetUserId,
            restaurant_id,
            role: "owner",
          });
        }

        if (isOwnerSuperAdmin && targetUserId !== callerId) {
          await adminClient
            .from("user_roles")
            .delete()
            .eq("user_id", callerId)
            .eq("restaurant_id", restaurant_id)
            .eq("role", "owner");
        }

        const { data: profile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (!profile) {
          await adminClient.from("profiles").insert({
            user_id: targetUserId,
            full_name: body.full_name || rest.name,
          });
        }

        return new Response(JSON.stringify({
          success: true,
          owner_id: targetUserId,
          email: cleanEmail,
          message: "Proprietário atualizado e vinculado ao restaurante.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // If already a separate user, update their credentials directly
      const updates: Record<string, any> = {};
      if (email) {
        updates.email = cleanEmail;
        updates.email_confirm = true;
      }
      if (password) updates.password = password;

      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await adminClient.auth.admin.updateUserById(targetUserId, updates);
        if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (cleanEmail) {
        await adminClient.from("restaurants").update({ email: cleanEmail }).eq("id", restaurant_id);
      }

      return new Response(JSON.stringify({
        success: true,
        owner_id: targetUserId,
        email: cleanEmail || rest.email,
        message: "Credenciais atualizadas com sucesso.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default: update user
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const updates: Record<string, any> = {};
    if (email) {
      updates.email = email.trim().toLowerCase();
      updates.email_confirm = true;
    }
    if (password) updates.password = password;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "Nada para atualizar" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(user_id, updates);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, user: { id: data.user.id, email: data.user.email } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
