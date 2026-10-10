import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all trial subscriptions where trial_ends_at has passed
    const { data: expired, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("id, restaurant_id")
      .eq("status", "trial")
      .lt("trial_ends_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;

    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ message: "No expired trials", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let count = 0;
    for (const sub of expired) {
      // Update subscription status to suspended
      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({ status: "suspended" })
        .eq("id", sub.id);

      // Update restaurant status to suspended
      const { error: restErr } = await supabase
        .from("restaurants")
        .update({ status: "suspended" })
        .eq("id", sub.restaurant_id);

      if (!subErr && !restErr) {
        count++;
        // Notify master admin
        try {
          const { data: rest } = await supabase
            .from("restaurants")
            .select("name, email")
            .eq("id", sub.restaurant_id)
            .maybeSingle();
          await supabase.functions.invoke("master-notify", {
            body: {
              event_type: "trial_expired",
              payload: {
                restaurant_name: rest?.name || "—",
                owner_email: rest?.email,
              },
            },
          });
        } catch (e) { console.warn("master notify failed", e); }
      }
    }

    return new Response(
      JSON.stringify({ message: `Suspended ${count} expired trials`, count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
