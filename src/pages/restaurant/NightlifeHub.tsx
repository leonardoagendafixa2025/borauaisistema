import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { useAuth } from '@/hooks/useAuth';
import { useLiveOps } from '@/hooks/useLiveOps';
import { supabase } from '@/integrations/supabase/client';
import {
  Disc3, Music, Zap, Users, Sparkles, ArrowUpRight, PlayCircle, Clock,
} from 'lucide-react';

export default function NightlifeHub() {
  const { restaurantId } = useAuth();
  const live = useLiveOps();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i); }, []);

  const { data: requests = [] } = useQuery({
    queryKey: ['nightlife-hub-req', restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('music_requests' as any)
        .select('id,song_title,artist,status,billing_mode,table_number,created_at')
        .eq('restaurant_id', restaurantId!)
        .in('status', ['queued', 'playing', 'pending_approval'])
        .order('created_at', { ascending: true })
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  const { data: lineup = [] } = useQuery({
    queryKey: ['nightlife-hub-lineup', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('nightlife_lineup' as any)
        .select('id,artist_name,starts_at,ends_at,status')
        .eq('restaurant_id', restaurantId!)
        .order('starts_at', { ascending: true })
        .limit(6);
      return (data ?? []) as any[];
    },
  });

  const { data: hourDrink } = useQuery({
    queryKey: ['nightlife-hub-drink', restaurantId, now.getHours()],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('hour_drinks' as any)
        .select('id,product_name,price,starts_at,ends_at')
        .eq('restaurant_id', restaurantId!)
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at', new Date().toISOString())
        .maybeSingle();
      return data as any;
    },
  });

  const playing = requests.find(r => r.status === 'playing');
  const queue = requests.filter(r => r.status === 'queued');
  const pendingApproval = requests.filter(r => r.status === 'pending_approval');

  return (
    <RestaurantLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-border">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <Disc3 className="h-6 w-6 text-primary" />
              Hub Balada
            </h1>
            <p className="text-xs text-muted-foreground">DJ, line-up, hour drinks e fila ao vivo.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/restaurant/dj" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">Painel DJ →</Link>
            <Link to="/restaurant/programacao" className="px-3 py-1.5 rounded-lg border border-border">Programação</Link>
            <Link to="/restaurant/balada" className="px-3 py-1.5 rounded-lg border border-border">Modo Balada</Link>
            <Link to="/restaurant/balada/pulseiras" className="px-3 py-1.5 rounded-lg border border-border">🎟️ Pulseiras</Link>
            <Link to="/garcom/bar" className="px-3 py-1.5 rounded-lg border border-border">🍺 Painel Bar</Link>
          </div>
        </div>

        {/* Now playing + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                <PlayCircle className={`h-8 w-8 text-primary ${playing ? 'animate-pulse' : 'opacity-40'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Tocando agora</div>
                {playing ? (
                  <>
                    <div className="font-bold text-lg truncate">{playing.song_title}</div>
                    <div className="text-sm text-muted-foreground truncate">{playing.artist || '—'}</div>
                  </>
                ) : (
                  <div className="font-semibold text-muted-foreground">Sem música tocando</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">Na fila</div>
                <div className="text-3xl font-bold tabular-nums">{queue.length}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-warning/30 bg-warning/5 p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Hour Drink ativo</div>
            </div>
            {hourDrink ? (
              <>
                <div className="font-bold text-lg truncate mt-1">{hourDrink.product_name}</div>
                <div className="text-sm">R$ {Number(hourDrink.price).toFixed(2)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">até {new Date(hourDrink.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground mt-2">Nenhum drink ativo agora.</div>
            )}
            <Link to="/restaurant/programacao" className="mt-2 block text-center text-xs text-primary hover:underline">Programar →</Link>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Queue */}
          <section className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Fila do DJ</h2>
                {pendingApproval.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-semibold">{pendingApproval.length} p/ aprovar</span>
                )}
              </div>
              <Link to="/restaurant/dj" className="text-xs text-primary hover:underline flex items-center gap-0.5">Painel DJ <ArrowUpRight className="h-3 w-3" /></Link>
            </header>
            {requests.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum pedido na fila.</div>
            ) : (
              <ul className="divide-y divide-border">
                {requests.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="w-5 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{r.song_title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.artist || '—'}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {r.billing_mode === 'table' ? `Mesa ${r.table_number}` : 'Comanda'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      r.status === 'playing' ? 'bg-success/15 text-success' :
                      r.status === 'pending_approval' ? 'bg-warning/15 text-warning' :
                      'bg-primary/15 text-primary'
                    }`}>
                      {r.status === 'playing' ? 'Tocando' : r.status === 'pending_approval' ? 'Aprovar' : 'Fila'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Lineup */}
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h2 className="font-semibold text-sm">Line-up</h2>
              </div>
              <Link to="/restaurant/programacao" className="text-xs text-primary hover:underline">Editar</Link>
            </header>
            {lineup.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sem programação.</div>
            ) : (
              <ul className="divide-y divide-border">
                {lineup.map(l => (
                  <li key={l.id} className="px-3 py-2 text-sm flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{l.artist_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(l.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {l.ends_at && ` → ${new Date(l.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      l.status === 'live' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                    }`}>{l.status || 'agendado'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </RestaurantLayout>
  );
}
