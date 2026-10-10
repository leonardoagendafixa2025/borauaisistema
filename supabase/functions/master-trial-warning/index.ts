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

    const now = Date.now();
    const in3days = new Date(now + 3 * 86400000).toISOString();
    const in1day = new Date(now + 1 * 86400000).toISOString();

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, restaurant_id, trial_ends_at, restaurants(name, email)')
      .eq('status', 'trial')
      .lt('trial_ends_at', in3days)
      .gt('trial_ends_at', new Date(now).toISOString());

    let sent = 0;
    for (const s of subs || []) {
      const trialEnd = new Date(s.trial_ends_at).getTime();
      const days_left = Math.max(0, Math.ceil((trialEnd - now) / 86400000));
      // Only notify on 3 / 1 / 0 day marks
      if (![3, 1, 0].includes(days_left)) continue;

      const r: any = (s as any).restaurants;

      // Try to fetch owner phone from profiles
      let owner_phone: string | null = null;
      if (r?.email) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('phone, user_id')
          .limit(1);
        owner_phone = prof?.[0]?.phone || null;
      }

      await supabase.functions.invoke('master-notify', {
        body: {
          event_type: 'trial_expiring',
          payload: {
            restaurant_name: r?.name || 'Restaurante',
            owner_email: r?.email,
            owner_phone,
            days_left,
          },
        },
      });
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('master-trial-warning error:', e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
