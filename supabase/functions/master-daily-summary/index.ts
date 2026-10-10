import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    // Restaurant counts by status
    const { data: rests } = await supabase.from('restaurants').select('id, status, created_at');
    const active_count = (rests || []).filter((r: any) => r.status === 'active').length;
    const trial_count = (rests || []).filter((r: any) => r.status === 'trial').length;
    const new_today = (rests || []).filter((r: any) => r.created_at >= startOfDay).length;

    // MRR: sum of active subscriptions' plan price
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('subscription_plans(price)')
      .eq('status', 'active');
    const mrr = (activeSubs || []).reduce(
      (s: number, x: any) => s + Number(x.subscription_plans?.price || 0),
      0
    );

    // Revenue today (subscription_payments approved)
    const { data: paysToday } = await supabase
      .from('subscription_payments')
      .select('amount, status')
      .gte('paid_at', startOfDay);
    const revenue_today = (paysToday || [])
      .filter((p: any) => p.status === 'approved')
      .reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    const payments_failed_today = (paysToday || []).filter((p: any) => p.status === 'rejected').length;

    // Orders today across platform
    const { count: orders_today } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .neq('status', 'cancelled');

    // Cancelled subscriptions today
    const { count: cancelled_today } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('updated_at', startOfDay);

    const payload = {
      date: today.toISOString(),
      active_count,
      trial_count,
      new_today,
      mrr,
      revenue_today,
      orders_today: orders_today || 0,
      payments_failed_today,
      cancelled_today: cancelled_today || 0,
    };

    await supabase.functions.invoke('master-notify', {
      body: { event_type: 'daily_platform_summary', payload },
    });

    return new Response(JSON.stringify({ ok: true, payload }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('master-daily-summary error:', e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
