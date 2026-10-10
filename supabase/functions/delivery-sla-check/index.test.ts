import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FN_URL = `${SUPABASE_URL}/functions/v1/delivery-sla-check`;
const RESTAURANT_ID = "c438a4c2-3126-4184-b397-114dcbe2c2ad"; // Bar da Nega

async function callFn() {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const json = await res.json();
  return { status: res.status, json };
}

Deno.test("delivery-sla-check responds OK", async () => {
  const { status, json } = await callFn();
  assertEquals(status, 200);
  assert(json.ok === true);
  assert(typeof json.scanned === "number");
  assert(typeof json.alerted === "number");
});

if (SERVICE_KEY) {
  Deno.test({
    name: "cooldown: same late order is not re-alerted within 15min window",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Insert a late delivery order (created 90min ago, prep_time default 30 + 0 buffer => 60min late)
    const created = new Date(Date.now() - 90 * 60_000).toISOString();
    const { data: inserted, error: insErr } = await admin
      .from("orders")
      .insert({
        restaurant_id: RESTAURANT_ID,
        customer_name: "TEST_SLA_COOLDOWN",
        type: "delivery",
        status: "preparing",
        subtotal: 10,
        total: 10,
        address: "Rua Teste SLA, 1",
        created_at: created,
      })
      .select()
      .single();

    if (insErr) throw insErr;
    const orderId = inserted!.id;

    try {
      // First run -> should alert (1)
      const r1 = await callFn();
      assertEquals(r1.status, 200);

      const { data: o1 } = await admin
        .from("orders").select("sla_alert_sent_at").eq("id", orderId).single();
      assert(o1?.sla_alert_sent_at, "first run should set sla_alert_sent_at");

      // Second run immediately -> cooldown blocks re-alert
      const r2 = await callFn();
      assertEquals(r2.status, 200);

      const { data: o2 } = await admin
        .from("orders").select("sla_alert_sent_at").eq("id", orderId).single();
      assertEquals(o2?.sla_alert_sent_at, o1?.sla_alert_sent_at,
        "cooldown must prevent re-alert (timestamp unchanged)");
    } finally {
      await admin.from("orders").delete().eq("id", orderId);
    }
    },
  });

  Deno.test({
    name: "legacy guard: order older than 24h is not alerted",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
    const created = new Date(Date.now() - 26 * 3600_000).toISOString();
    const { data: inserted, error: insErr } = await admin
      .from("orders")
      .insert({
        restaurant_id: RESTAURANT_ID,
        customer_name: "TEST_SLA_LEGACY",
        type: "delivery",
        status: "delivering",
        subtotal: 10,
        total: 10,
        address: "Rua Teste Legacy, 1",
        created_at: created,
      })
      .select()
      .single();
    if (insErr) throw insErr;
    const orderId = inserted!.id;

    try {
      await callFn();
      const { data: o } = await admin
        .from("orders").select("sla_alert_sent_at").eq("id", orderId).single();
      assertEquals(o?.sla_alert_sent_at, null,
        "orders older than MAX_ORDER_AGE_HOURS must not be alerted");
    } finally {
      await admin.from("orders").delete().eq("id", orderId);
    }
    },
  });
}
