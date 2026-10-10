import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Role = "manager" | "attendant" | "kitchen";
const ALLOWED_ROLES: Role[] = ["manager", "attendant", "kitchen"];
// Hierarquia local: owner=4, manager=3, attendant=2, kitchen=1
const RANK: Record<string, number> = { owner: 4, manager: 3, attendant: 2, kitchen: 1 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Token inválido" }, 401);
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { action, restaurant_id, target_user_id, role, email, password, full_name, phone } = body as {
      action: string;
      restaurant_id?: string;
      target_user_id?: string;
      role?: Role;
      email?: string;
      password?: string;
      full_name?: string;
      phone?: string;
    };

    if (!action) return json({ error: "action é obrigatório" }, 400);
    if (!restaurant_id) return json({ error: "restaurant_id é obrigatório" }, 400);

    // Verifica permissão do caller no restaurante
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("restaurant_id", restaurant_id);

    const isSuper = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "super_admin")
      .maybeSingle();

    const callerTopRank = (callerRoles || []).reduce(
      (acc: number, r: any) => Math.max(acc, RANK[r.role] || 0),
      0,
    );
    const isOwner = callerTopRank >= 4;
    const isManagerOrAbove = callerTopRank >= 3 || !!isSuper.data;

    if (!isManagerOrAbove) return json({ error: "Sem permissão neste restaurante" }, 403);

    // ---- LIST ----
    if (action === "list") {
      const { data: rolesRows } = await admin
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .eq("restaurant_id", restaurant_id)
        .in("role", ["owner", "manager", "attendant", "kitchen"])
        .order("created_at", { ascending: false });

      const userIds = [...new Set((rolesRows || []).map((r: any) => r.user_id))];
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const { data: { users: authUsers } = { users: [] } } = await admin.auth.admin.listUsers();
      const emailMap: Record<string, string> = {};
      (authUsers || []).forEach((u: any) => {
        if (u.id && u.email) emailMap[u.id] = u.email;
      });

      const enriched = (rolesRows || []).map((r: any) => {
        const p = (profs || []).find((x: any) => x.user_id === r.user_id);
        return {
          ...r,
          email: emailMap[r.user_id] || null,
          full_name: p?.full_name || null,
          phone: p?.phone || null,
        };
      });
      return json({ staff: enriched });
    }

    // ---- CREATE ----
    if (action === "create") {
      if (!email || !password || !full_name || !role) {
        return json({ error: "email, password, full_name e role são obrigatórios" }, 400);
      }
      if (!ALLOWED_ROLES.includes(role)) {
        return json({ error: "role inválido" }, 400);
      }
      // Manager não pode criar manager (apenas owner pode)
      if (role === "manager" && !isOwner && !isSuper.data) {
        return json({ error: "Apenas o proprietário pode criar gerentes" }, 403);
      }
      if (password.length < 6) return json({ error: "Senha deve ter ≥ 6 caracteres" }, 400);

      // Tenta criar; se já existe, reaproveita
      let userId: string | null = null;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) {
        console.log("createUser error:", JSON.stringify(createErr));
        const msg = (createErr as any)?.message || "";
        const code = (createErr as any)?.code || (createErr as any)?.error_code || "";
        const status = (createErr as any)?.status;
        const isDuplicate =
          /already (been )?registered|already exists|email[_ ]exists|duplicate|user with this email/i.test(msg) ||
          /email_exists|user_already_exists/i.test(String(code)) ||
          status === 422;
        if (isDuplicate) {
          // Pagina listUsers para encontrar
          let existing: any = null;
          for (let page = 1; page <= 20 && !existing; page++) {
            const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
            existing = (data?.users || []).find((u: any) => u.email?.toLowerCase() === email);
            if (!data?.users || data.users.length < 200) break;
          }
          if (!existing) return json({ error: `E-mail já cadastrado mas usuário não localizado (${msg})` }, 400);
          userId = existing.id;
          const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password });
          if (updErr) {
            console.log("updateUser error:", JSON.stringify(updErr));
            return json({ error: `Falha ao atualizar senha: ${updErr.message}` }, 400);
          }
        } else {
          return json({ error: msg || "Erro ao criar usuário" }, 400);
        }
      } else {
        userId = created.user!.id;
      }

      // upsert profile
      const profilePayload: Record<string, unknown> = { user_id: userId, full_name };
      if (phone !== undefined) profilePayload.phone = (phone || "").trim() || null;
      await admin.from("profiles").upsert(profilePayload, { onConflict: "user_id" });

      // Bloqueia duplicidade de role no mesmo restaurante
      const { data: existingRole } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("restaurant_id", restaurant_id)
        .eq("role", role)
        .maybeSingle();
      if (!existingRole) {
        const { error: roleErr } = await admin.from("user_roles").insert({
          user_id: userId,
          restaurant_id,
          role,
        });
        if (roleErr) return json({ error: roleErr.message }, 400);
      }

      return json({ success: true, user_id: userId });
    }

    // ---- RESET PASSWORD ----
    if (action === "reset-password") {
      if (!target_user_id || !password) return json({ error: "target_user_id e password obrigatórios" }, 400);
      if (password.length < 6) return json({ error: "Senha deve ter ≥ 6 caracteres" }, 400);

      // Garante que o alvo pertence a este restaurante
      const { data: tgt } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", target_user_id)
        .eq("restaurant_id", restaurant_id);
      if (!tgt || tgt.length === 0) return json({ error: "Usuário não pertence a este restaurante" }, 403);

      // Manager não pode resetar senha de owner
      const tgtTopRank = tgt.reduce((acc: number, r: any) => Math.max(acc, RANK[r.role] || 0), 0);
      if (tgtTopRank >= 4 && !isOwner && !isSuper.data) {
        return json({ error: "Sem permissão para alterar este usuário" }, 403);
      }

      const { error } = await admin.auth.admin.updateUserById(target_user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ---- REMOVE (apenas tira o vínculo no restaurante; não deleta auth user) ----
    if (action === "remove") {
      if (!target_user_id || !role) return json({ error: "target_user_id e role obrigatórios" }, 400);
      if (target_user_id === callerId) return json({ error: "Você não pode se remover" }, 400);

      // Bloqueia remover owner se caller não for owner/super
      if (role === "owner" && !isOwner && !isSuper.data) {
        return json({ error: "Apenas o proprietário pode remover outro proprietário" }, 403);
      }

      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id)
        .eq("restaurant_id", restaurant_id)
        .eq("role", role);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err: any) {
    return json({ error: err?.message || "Erro inesperado" }, 500);
  }
});
