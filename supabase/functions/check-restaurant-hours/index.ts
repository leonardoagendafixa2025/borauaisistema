import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: restaurants, error: rErr } = await supabase
      .from("restaurants")
      .select("id, is_open, status, force_closed")
      .in("status", ["active", "trial"]);

    if (rErr) throw rErr;

    const { data: allSettings, error: sErr } = await supabase
      .from("restaurant_settings")
      .select("restaurant_id, opening_hours");

    if (sErr) throw sErr;

    const settingsMap = new Map(allSettings?.map((s: any) => [s.restaurant_id, s.opening_hours]) || []);

    const now = new Date();
    const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayIndex = brTime.getDay();
    const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDay = dayKeys[dayIndex];
    const currentTime = `${String(brTime.getHours()).padStart(2, "0")}:${String(brTime.getMinutes()).padStart(2, "0")}`;

    let updated = 0;

    for (const restaurant of restaurants || []) {
      // If force_closed is on, restaurant must stay closed
      if (restaurant.force_closed) {
        if (restaurant.is_open) {
          await supabase.from("restaurants").update({ is_open: false }).eq("id", restaurant.id);
          updated++;
        }
        continue;
      }

      const hours = settingsMap.get(restaurant.id) as Record<string, any> | null;

      // Se não há horários configurados (vazio ou null), o cron NÃO interfere.
      // O restaurante fica sob controle manual via botão "Abrir/Fechar".
      const hasAnyHoursConfigured = hours && typeof hours === "object" && Object.keys(hours).length > 0;
      if (!hasAnyHoursConfigured) {
        continue;
      }

      let shouldBeOpen = false;

      if (hours[currentDay]) {
        const dayConfig = hours[currentDay];
        if (dayConfig.enabled !== false && dayConfig.open && dayConfig.close) {
          if (dayConfig.close < dayConfig.open) {
            shouldBeOpen = currentTime >= dayConfig.open || currentTime < dayConfig.close;
          } else {
            shouldBeOpen = currentTime >= dayConfig.open && currentTime < dayConfig.close;
          }
        }
      }

      if (restaurant.is_open !== shouldBeOpen) {
        await supabase.from("restaurants").update({ is_open: shouldBeOpen }).eq("id", restaurant.id);
        updated++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked: restaurants?.length || 0, updated, time: currentTime, day: currentDay }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
