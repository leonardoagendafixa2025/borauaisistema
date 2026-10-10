// Provisions a restaurant + settings + trial subscription + owner role for a freshly signed-up user.
// Uses service role so it works even when the user's email is not confirmed yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  email: string;
  restaurantName: string;
  ownerName?: string;
  phone?: string;
  planTier?: string;   // when planId is a fallback-* one
  planId?: string;     // real uuid from subscription_plans
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const { email, restaurantName, ownerName, phone, planTier, planId } = body;

    if (!email || !restaurantName) {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // 1. Find the auth user by email (signUp was already done client-side)
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const user = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      return new Response(JSON.stringify({ error: "user_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    // 2. If this user already owns a restaurant, just return it (idempotent)
    const { data: existing } = await admin
      .from("restaurants")
      .select("id, slug")
      .eq("owner_id", userId)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, restaurant_id: existing.id, slug: existing.slug, alreadyProvisioned: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Build a unique slug
    const baseSlug = restaurantName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "restaurante";
    let slug = baseSlug;
    for (let i = 1; i < 30; i++) {
      const { data: clash } = await admin.from("restaurants").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${baseSlug}-${i + 1}`;
    }

    // 4. Resolve plan
    let realPlanId = planId && !planId.startsWith("fallback-") ? planId : null;
    let realPlanPrice = 0;
    if (!realPlanId && planTier) {
      const { data: realPlan } = await admin
        .from("subscription_plans")
        .select("id, price")
        .eq("tier", planTier)
        .eq("active", true)
        .maybeSingle();
      if (realPlan) {
        realPlanId = realPlan.id;
        realPlanPrice = Number(realPlan.price) || 0;
      }
    } else if (realPlanId) {
      const { data: p } = await admin.from("subscription_plans").select("price").eq("id", realPlanId).maybeSingle();
      realPlanPrice = Number(p?.price) || 0;
    }
    if (!realPlanId) {
      // fallback to any active plan
      const { data: anyPlan } = await admin
        .from("subscription_plans")
        .select("id, price")
        .eq("active", true)
        .order("price")
        .limit(1)
        .maybeSingle();
      realPlanId = anyPlan?.id ?? null;
      realPlanPrice = Number(anyPlan?.price) || 0;
    }

    // 5. Create restaurant
    const { data: restaurant, error: restErr } = await admin
      .from("restaurants")
      .insert({
        name: restaurantName,
        slug,
        owner_id: userId,
        phone: phone || null,
        email,
        status: "trial",
      } as any)
      .select()
      .single();
    if (restErr) throw restErr;

    // 6. Settings
    await admin.from("restaurant_settings").insert({ restaurant_id: restaurant.id } as any);

    // 7. Trial subscription (14 days)
    if (realPlanId) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await admin.from("subscriptions").insert({
        restaurant_id: restaurant.id,
        plan_id: realPlanId,
        status: "trial",
        trial_ends_at: trialEnd.toISOString(),
        monthly_price: realPlanPrice,
        current_period_end: trialEnd.toISOString(),
      } as any);
    }

    // 8. Owner role
    await admin.from("user_roles").insert({
      user_id: userId,
      role: "owner",
      restaurant_id: restaurant.id,
    } as any);

    // 9. Update profile name if provided
    if (ownerName) {
      await admin.from("profiles").update({ full_name: ownerName }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ ok: true, restaurant_id: restaurant.id, slug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("provision-restaurant error", e);
    return new Response(JSON.stringify({ error: e.message || "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
