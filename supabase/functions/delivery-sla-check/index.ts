import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SLA buffers per status (minutes added to estimated_prep_time)
const SLA_BUFFER: Record<string, number> = {
  preparing: 0,    // breached when prep_time exceeded
  ready: 10,       // ready waiting too long for driver
  delivering: 30,  // out for delivery > prep_time + 30min
};

// Re-alert cooldown so we don't spam
const RE_ALERT_MINUTES = 15;

// Hard cap: never alert orders older than this (avoid spam on legacy/forgotten orders)
const MAX_ORDER_AGE_HOURS = 24;
// Only alert orders that breached SLA recently (avoid alerting on orders that have been late for hours)
const MAX_BREACH_AGE_MINUTES = 120;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Fetch active delivery orders with restaurant settings
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, number, status, type, total, address, customer_name, customer_phone,
        created_at, sla_alert_sent_at, sla_acknowledged_at, restaurant_id, driver_id,
        delivery_drivers ( name )
      `)
      .eq('type', 'delivery')
      .is('sla_acknowledged_at', null)
      .in('status', ['preparing', 'ready', 'delivering']);

    if (error) throw error;

    const now = Date.now();
    const restaurantPrepTimes = new Map<string, number>();
    let alerted = 0;
    let scanned = orders?.length || 0;

    for (const o of orders || []) {
      // Get prep time for this restaurant (cached)
      let prepTime = restaurantPrepTimes.get(o.restaurant_id);
      if (prepTime === undefined) {
        const { data: settings } = await supabase
          .from('restaurant_settings')
          .select('estimated_prep_time')
          .eq('restaurant_id', o.restaurant_id)
          .single();
        prepTime = settings?.estimated_prep_time || 30;
        restaurantPrepTimes.set(o.restaurant_id, prepTime);
      }

      const buffer = SLA_BUFFER[o.status] ?? 0;
      const slaLimitMs = (prepTime + buffer) * 60_000;
      const ageMs = now - new Date(o.created_at).getTime();

      if (ageMs <= slaLimitMs) continue;

      // Skip orders that are too old (legacy / forgotten)
      if (ageMs > MAX_ORDER_AGE_HOURS * 3600_000) continue;

      // Skip orders that breached SLA too long ago (avoid spam on stuck orders)
      const breachAgeMs = ageMs - slaLimitMs;
      if (breachAgeMs > MAX_BREACH_AGE_MINUTES * 60_000) continue;

      // Cooldown check — once alerted, only re-alert after RE_ALERT_MINUTES
      if (o.sla_alert_sent_at) {
        const sinceLastAlert = now - new Date(o.sla_alert_sent_at).getTime();
        if (sinceLastAlert < RE_ALERT_MINUTES * 60_000) continue;
      }

      const minutesLate = Math.floor((ageMs - slaLimitMs) / 60_000);
      const driverName = (o.delivery_drivers as any)?.name || null;

      const statusLabels: Record<string, string> = {
        preparing: 'Em preparo',
        ready: 'Pronto aguardando',
        delivering: 'Saiu para entrega',
      };

      // Fire telegram notification
      const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-notify`;
      await fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          restaurant_id: o.restaurant_id,
          event_type: 'delivery_sla_breach',
          payload: {
            order_id: o.id,
            number: o.number,
            type: o.type,
            status: statusLabels[o.status] || o.status,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            address: o.address,
            total: o.total,
            minutes_late: minutesLate,
            driver_name: driverName,
          },
        }),
      });

      // Mark alerted
      await supabase
        .from('orders')
        .update({ sla_alert_sent_at: new Date().toISOString() })
        .eq('id', o.id);

      alerted++;
    }

    return new Response(
      JSON.stringify({ ok: true, scanned, alerted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    console.error('delivery-sla-check error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
