// Master broadcast: envia mensagem em massa via Telegram para restaurantes segmentados
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastPayload {
  template_key?: string;
  body: string;
  subject?: string;
  channel?: "telegram" | "in_app";
  segment?: {
    plan_tier?: string;
    status?: string;
    restaurant_ids?: string[];
  };
  variables?: Record<string, string>;
}

function applyVars(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TG_TOKEN = Deno.env.get("TELEGRAM_API_KEY");

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

    const payload: BroadcastPayload = await req.json();
    const channel = payload.channel ?? "telegram";

    // Build recipient query
    let q = admin.from("restaurants").select("id, name, owner_id, status").not("owner_id", "is", null);
    if (payload.segment?.status) q = q.eq("status", payload.segment.status as any);
    if (payload.segment?.restaurant_ids?.length) q = q.in("id", payload.segment.restaurant_ids);

    const { data: restaurants } = await q;
    let targets = restaurants ?? [];

    // Filter by plan_tier if needed
    if (payload.segment?.plan_tier) {
      const { data: subs } = await admin
        .from("subscriptions")
        .select("restaurant_id, plan_id, subscription_plans!inner(tier)")
        .eq("subscription_plans.tier", payload.segment.plan_tier as any);
      const validIds = new Set((subs ?? []).map((s: any) => s.restaurant_id));
      targets = targets.filter((r) => validIds.has(r.id));
    }

    // Create broadcast record
    const { data: bc, error: bcErr } = await admin
      .from("master_broadcasts")
      .insert({
        sent_by: user.id,
        template_key: payload.template_key ?? null,
        channel,
        subject: payload.subject ?? null,
        body: payload.body,
        segment: payload.segment ?? {},
        total_recipients: targets.length,
        status: "sending",
      })
      .select()
      .single();
    if (bcErr) throw bcErr;

    let sent = 0;
    let failed = 0;

    if (channel === "telegram" && TG_TOKEN) {
      // For each restaurant, look up telegram chat IDs (staff links + settings)
      for (const r of targets) {
        try {
          const { data: staff } = await admin
            .from("telegram_staff_links")
            .select("chat_id")
            .eq("restaurant_id", r.id)
            .eq("active", true);
          const { data: setting } = await admin
            .from("restaurant_settings")
            .select("telegram_chat_id")
            .eq("restaurant_id", r.id)
            .maybeSingle();

          const chats = new Set<string>();
          (staff ?? []).forEach((s: any) => s.chat_id && chats.add(s.chat_id));
          if (setting?.telegram_chat_id) chats.add(setting.telegram_chat_id);

          if (chats.size === 0) {
            failed++;
            continue;
          }

          const text = applyVars(payload.body, { ...payload.variables, nome: r.name });

          for (const chatId of chats) {
            const tgRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
            });
            if (tgRes.ok) sent++;
            else failed++;
          }
        } catch (e) {
          failed++;
        }
      }
    } else if (channel === "in_app") {
      for (const r of targets) {
        if (!r.owner_id) {
          failed++;
          continue;
        }
        const text = applyVars(payload.body, { ...payload.variables, nome: r.name });
        const { error } = await admin.from("notifications").insert({
          user_id: r.owner_id,
          restaurant_id: r.id,
          type: "broadcast",
          title: payload.subject ?? "Comunicado",
          message: text,
        });
        if (error) failed++;
        else sent++;
      }
    }

    await admin
      .from("master_broadcasts")
      .update({
        sent_count: sent,
        failed_count: failed,
        status: failed === 0 ? "completed" : sent === 0 ? "failed" : "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", bc.id);

    return new Response(JSON.stringify({ broadcast_id: bc.id, sent, failed, total: targets.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("broadcast error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
