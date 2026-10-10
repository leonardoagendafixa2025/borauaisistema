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

    // All restaurants with telegram linked
    const { data: linked } = await supabase
      .from('restaurant_settings')
      .select('restaurant_id, telegram_chat_id, restaurants(name)')
      .not('telegram_chat_id', 'is', null);

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();
    const dueTomorrow = new Date();
    dueTomorrow.setDate(dueTomorrow.getDate() + 1);
    const dueTomorrowDate = dueTomorrow.toISOString().split('T')[0];

    let sent = 0;

    for (const row of linked || []) {
      const restaurantId = row.restaurant_id;
      const restaurantName = (row as any).restaurants?.name || 'Restaurante';

      // Orders today (exclude cancelled)
      const { data: orders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceIso);

      const valid = (orders || []).filter((o: any) => o.status !== 'cancelled');
      const ordersCount = valid.length;
      const revenue = valid.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;

      // NPS today
      const { data: surveys } = await supabase
        .from('satisfaction_surveys')
        .select('score')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceIso);

      let nps: number | null = null;
      if (surveys && surveys.length > 0) {
        const promoters = surveys.filter((s: any) => s.score >= 9).length;
        const detractors = surveys.filter((s: any) => s.score <= 6).length;
        nps = Math.round(((promoters - detractors) / surveys.length) * 100);
      }

      // Expenses paid today
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('restaurant_id', restaurantId)
        .eq('paid_at', sinceIso.split('T')[0]);

      const expensesTotal = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      // Top 3 products today
      const validIds = valid.length > 0
        ? (await supabase.from('orders').select('id').eq('restaurant_id', restaurantId).gte('created_at', sinceIso).neq('status', 'cancelled')).data?.map((o: any) => o.id) || []
        : [];
      let topProducts: { name: string; qty: number }[] = [];
      if (validIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items').select('name, qty').in('order_id', validIds);
        const tally: Record<string, number> = {};
        (items || []).forEach((i: any) => { tally[i.name] = (tally[i.name] || 0) + Number(i.qty || 0); });
        topProducts = Object.entries(tally)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty).slice(0, 3);
      }

      // Send daily summary
      await supabase.functions.invoke('telegram-notify', {
        body: {
          restaurant_id: restaurantId,
          event_type: 'daily_summary',
          payload: {
            restaurant_name: restaurantName,
            orders_count: ordersCount,
            revenue,
            avg_ticket: avgTicket,
            nps,
            expenses: expensesTotal,
            top_products: topProducts,
          },
        },
      });
      sent++;

      // Check expenses due tomorrow
      const { data: dueExpenses } = await supabase
        .from('expenses')
        .select('description, amount, supplier')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .eq('due_date', dueTomorrowDate);

      for (const exp of dueExpenses || []) {
        await supabase.functions.invoke('telegram-notify', {
          body: {
            restaurant_id: restaurantId,
            event_type: 'expense_due',
            payload: exp,
          },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('daily-summary error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
