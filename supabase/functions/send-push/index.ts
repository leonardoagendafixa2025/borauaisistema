// Edge function: send-push
// Receives an event from DB triggers and fans out Web Push notifications
// to all push_subscriptions of the given restaurant.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// VAPID keys unificadas com frontend e API
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BJOZteu5NRKarKGeaue3DpKROnNvf90eviVFKCUn0eq-ZtCekAfRRnOGfYBk8y29Y6JyqO2kUaZDBc1bCPdTjag";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "b7p7vyy2HlmcmWzZ91na780C18tcFONv8c6DrMyBfQY";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@borauai.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Body {
  restaurant_id: string;
  event_type: "new_order" | "waiter_call" | "music_request";
  payload: Record<string, unknown>;
}

function fmtBRL(n: unknown) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildNotification(event: Body["event_type"], p: any) {
  switch (event) {
    case "new_order": {
      const typeLabel = p.type === "delivery" ? "Entrega" : p.type === "pickup" ? "Retirada" : "Mesa";
      return {
        title: `🆕 Novo pedido #${p.number}`,
        body: `${p.customer_name || "Cliente"} • ${typeLabel} • ${fmtBRL(p.total)}`,
        tag: `order-${p.order_id}`,
        url: "/garcom",
        vibrate: [200, 100, 200],
      };
    }
    case "waiter_call": {
      const isBill = p.type === "request_bill";
      return {
        title: isBill ? `💰 Pedido de conta` : `🔔 Chamada de garçom`,
        body: `${p.table_label || "Mesa"} precisa de atendimento`,
        tag: `call-${p.call_id}`,
        url: "/garcom",
        vibrate: [400, 150, 400, 150, 400],
        requireInteraction: true,
      };
    }
    case "music_request": {
      return {
        title: `🎵 Música pendente de aprovação`,
        body: `${p.song} — ${p.table_label || "Mesa"}${p.price ? ` • ${fmtBRL(p.price)}` : ""}`,
        tag: `music-${p.request_id}`,
        url: "/restaurant/dj",
        vibrate: [200, 100, 200, 100, 200],
      };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.restaurant_id || !body?.event_type) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notification = buildNotification(body.event_type, body.payload || {});
    if (!notification) {
      return new Response(JSON.stringify({ error: "unknown event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("restaurant_id", body.restaurant_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify(notification);
    let sent = 0;
    let removed = 0;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 },
          );
          sent++;
        } catch (err: any) {
          // 404/410 => subscription expired, remove it
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
            removed++;
          } else {
            console.error("[send-push] error:", s.endpoint, err?.statusCode, err?.body);
          }
        }
      }),
    );

    return new Response(JSON.stringify({ sent, removed, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-push] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || "fail" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
