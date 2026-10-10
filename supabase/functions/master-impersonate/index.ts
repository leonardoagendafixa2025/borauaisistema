// Master impersonate: gera magic link temporário para super admin "entrar como" dono de restaurante
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleCheck } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!roleCheck) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { restaurant_id, reason } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name, owner_id")
      .eq("id", restaurant_id)
      .single();

    if (!restaurant?.owner_id) {
      return new Response(JSON.stringify({ error: "Restaurant has no owner" }), { status: 400, headers: corsHeaders });
    }

    // Get owner email via auth admin
    const { data: ownerData } = await admin.auth.admin.getUserById(restaurant.owner_id);
    const ownerEmail = ownerData?.user?.email;
    if (!ownerEmail) {
      return new Response(JSON.stringify({ error: "Owner email not found" }), { status: 400, headers: corsHeaders });
    }

    // Generate magic link
    const redirectTo = `${req.headers.get("origin") ?? ""}/restaurant`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: ownerEmail,
      options: { redirectTo },
    });

    if (linkErr) throw linkErr;

    // Token registry (audit trail)
    const token = crypto.randomUUID();
    await admin.from("impersonation_tokens").insert({
      token,
      admin_user_id: user.id,
      target_user_id: restaurant.owner_id,
      restaurant_id: restaurant.id,
      reason: reason ?? null,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // Audit log
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "impersonate_started",
      entity_type: "restaurant",
      entity_id: restaurant.id,
      metadata: {
        restaurant_name: restaurant.name,
        target_user_id: restaurant.owner_id,
        reason: reason ?? null,
      },
    });

    return new Response(JSON.stringify({ magic_link: linkData.properties?.action_link, owner_email: ownerEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("impersonate error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
