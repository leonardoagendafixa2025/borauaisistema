import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Volume2, VolumeX, CheckCircle2, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const playDing = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.5);
  } catch {}
};

export default function BarPanelPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [soundOn, setSoundOn] = useState(true);
  const lastCount = useRef(0);

  const { data: orders = [] } = useQuery({
    queryKey: ['bar-queue', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await (supabase as any)
        .from('orders')
        .select('id, bar_status, bar_pickup_code, wristband_code, total, created_at, bar_ready_at, served_by, order_items(name, qty)')
        .eq('restaurant_id', restaurantId)
        .in('bar_status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true })
        .limit(100);
      return data || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 4000,
  });

  // Beep when new pending order arrives
  useEffect(() => {
    const pending = (orders as any[]).filter((o) => o.bar_status === 'pending').length;
    if (pending > lastCount.current && soundOn && lastCount.current >= 0) {
      playDing();
    }
    lastCount.current = pending;
  }, [orders, soundOn]);

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`bar-queue-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['bar-queue', restaurantId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  const grouped = useMemo(() => {
    const list = orders as any[];
    return {
      pending: list.filter((o) => o.bar_status === 'pending'),
      ready: list.filter((o) => o.bar_status === 'ready'),
    };
  }, [orders]);

  const updateStatus = async (id: string, next: 'ready' | 'delivered') => {
    const patch: any = { bar_status: next };
    if (next === 'ready') patch.bar_ready_at = new Date().toISOString();
    if (next === 'delivered') {
      patch.bar_delivered_at = new Date().toISOString();
      patch.status = 'completed';
    }
    const { error } = await (supabase as any).from('orders').update(patch).eq('id', id);
    if (error) toast.error('Erro ao atualizar');
    else qc.invalidateQueries({ queryKey: ['bar-queue', restaurantId] });
  };

  const elapsed = (iso: string) => {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora';
    return `${min} min`;
  };

  return (
    <div className="min-h-screen bg-foreground text-background flex flex-col">
      {/* Header */}
      <header className="bg-background/10 border-b border-background/10 px-4 py-3 flex items-center gap-3">
        <Link to="/garcom" className="p-1.5 -ml-1.5 rounded-lg hover:bg-background/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-xl flex items-center gap-2">
            🍺 Painel do Bar
          </h1>
          <p className="text-xs opacity-70">Pedidos para retirada no balcão</p>
        </div>
        <button
          onClick={() => setSoundOn((s) => !s)}
          className="p-2 rounded-lg bg-background/10 hover:bg-background/20"
          title={soundOn ? 'Som ligado' : 'Som mudo'}
        >
          {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 opacity-50" />}
        </button>
        <div className="text-right">
          <p className="text-[10px] opacity-70 uppercase">Fila</p>
          <p className="font-bold text-2xl text-amber-400">{grouped.pending.length}</p>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-y-auto">
        {/* Coluna PENDENTE */}
        <section>
          <h2 className="font-bold text-sm uppercase opacity-70 mb-2 px-1 flex items-center gap-2">
            <Package className="h-4 w-4" /> Para preparar ({grouped.pending.length})
          </h2>
          {grouped.pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-background/20 p-8 text-center text-background/50">
              Nenhum pedido aguardando.
            </div>
          ) : (
            <div className="space-y-2">
              {grouped.pending.map((o: any) => (
                <article
                  key={o.id}
                  className="rounded-xl bg-amber-500 text-foreground p-4 shadow-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[10px] uppercase opacity-70">Senha de retirada</p>
                      <p className="font-mono font-black text-3xl tracking-wider">
                        {o.bar_pickup_code || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase opacity-70">Pulseira</p>
                      <p className="font-mono font-black text-xl tracking-wider">
                        {o.wristband_code || '—'}
                      </p>
                      <p className="text-[10px] opacity-70 mt-1">há {elapsed(o.created_at)}</p>
                    </div>
                  </div>
                  <ul className="space-y-0.5 mb-3 border-t border-foreground/20 pt-2">
                    {(o.order_items || []).map((it: any, i: number) => (
                      <li key={i} className="font-bold text-base">
                        {it.qty}× {it.name}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => updateStatus(o.id, 'ready')}
                    className="w-full rounded-lg bg-foreground text-background py-3 font-black text-sm uppercase active:scale-95 transition-transform"
                  >
                    ✓ Marcar Pronto
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Coluna PRONTO */}
        <section>
          <h2 className="font-bold text-sm uppercase opacity-70 mb-2 px-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Aguardando cliente ({grouped.ready.length})
          </h2>
          {grouped.ready.length === 0 ? (
            <div className="rounded-xl border border-dashed border-background/20 p-8 text-center text-background/50">
              Nada pronto no momento.
            </div>
          ) : (
            <div className="space-y-2">
              {grouped.ready.map((o: any) => (
                <article
                  key={o.id}
                  className="rounded-xl bg-emerald-500 text-foreground p-4 shadow-lg animate-pulse-slow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[10px] uppercase opacity-70">Senha</p>
                      <p className="font-mono font-black text-3xl tracking-wider">
                        {o.bar_pickup_code || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase opacity-70">Pulseira</p>
                      <p className="font-mono font-black text-xl tracking-wider">
                        {o.wristband_code || '—'}
                      </p>
                      <p className="text-[10px] opacity-70 mt-1">
                        pronto há {elapsed(o.bar_ready_at || o.created_at)}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-0.5 mb-3 border-t border-foreground/20 pt-2 text-sm">
                    {(o.order_items || []).map((it: any, i: number) => (
                      <li key={i} className="font-bold">
                        {it.qty}× {it.name}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => updateStatus(o.id, 'delivered')}
                    className="w-full rounded-lg bg-foreground text-background py-3 font-black text-sm uppercase active:scale-95 transition-transform"
                  >
                    ✓ Entregue ao cliente
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
