import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

async function resolvePlanId(lookupKey: string | null | undefined): Promise<string | null> {
  if (!lookupKey) return null;
  const { data } = await getSupabase()
    .from("subscription_plans")
    .select("id")
    .eq("stripe_lookup_key", lookupKey)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const restaurantId = subscription.metadata?.restaurantId;
  if (!restaurantId) {
    console.error("No restaurantId in subscription metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const lookupKey: string | undefined = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id;
  const stripePriceId: string | undefined = item?.price?.id;
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const planId = await resolvePlanId(lookupKey);

  await getSupabase().from("subscriptions").upsert(
    {
      restaurant_id: restaurantId,
      plan_id: planId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      stripe_price_id: lookupKey ?? stripePriceId ?? null,
      stripe_product_id: productId ?? null,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  // Log payment for histórico
  const restaurantId = invoice.subscription_details?.metadata?.restaurantId
    ?? invoice.metadata?.restaurantId;
  if (!restaurantId) return;
  await getSupabase().from("subscription_payments").insert({
    restaurant_id: restaurantId,
    amount: (invoice.amount_paid ?? 0) / 100,
    status: invoice.status === "paid" ? "approved" : invoice.status,
    payment_method: "stripe",
    paid_at: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : new Date().toISOString(),
  } as any).then(() => {}, (err) => console.error("payment insert failed", err));
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
