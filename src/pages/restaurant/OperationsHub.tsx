import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { useRestaurantOrders, useRestaurantTables } from '@/hooks/useRestaurantData';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useLiveOps } from '@/hooks/useLiveOps';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ClipboardList, UtensilsCrossed, QrCode, BellRing, Truck, Disc3,
  ChevronRight, Activity, Filter, ArrowUpRight, Flame, CheckCheck,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const statusFlow: Record<string, OrderStatus> = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  waiting_pickup: 'completed',
};

const statusLabel: Record<string, string> = {
  new: 'Novo',
  accepted: 'Aceito',
  preparing: 'Preparando',
  ready: 'Pronto',
  waiting_pickup: 'Retirada',
  delivering: 'Entregando',
};

const elapsed = (d: string) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
};

export default function OperationsHub() {
  useRealtimeOrders();
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const live = useLiveOps();
  const { data: tables = [] } = useRestaurantTables();
  const { data: activeOrders = [] } = useRestaurantOrders(['new', 'accepted', 'preparing', 'ready', 'waiting_pickup', 'delivering']);

  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'pickup' | 'dine_in'>('all');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Pending waiter calls (live)
  const { data: pendingCalls = [] } = useQuery({
    queryKey: ['ops-hub-calls', restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('waiter_calls')
        .select('id, table_id, table_number, type, message, created_at')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(8);
      return data ?? [];
    },
  });

  const filteredOrders = useMemo(() => {
    const list = typeFilter === 'all' ? activeOrders : activeOrders.filter(o => o.type === typeFilter);
    return list.slice(0, 12);
  }, [activeOrders, typeFilter]);

  const occupiedTables = useMemo(() => tables.filter(t => t.status === 'occupied').slice(0, 12), [tables]);

  const advance = async (id: string, current: string) => {
    const next = statusFlow[current];
    if (!next) return;
    const { error } = await supabase.from('orders').update({ status: next } as any).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(`→ ${statusLabel[next] || next}`);
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const ackCall = async (id: string) => {
    const { error } = await supabase.from('waiter_calls').update({ status: 'acknowledged' } as any).eq('id', id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['ops-hub-calls'] });
  };

  return (
    <RestaurantLayout>
      <div className="space-y-4">
        {/* Header denso */}
        <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-border">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Central Operacional
            </h1>
            <p className="text-xs text-muted-foreground">Tudo que importa agora, em uma tela só. Atualiza ao vivo.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill icon={ClipboardList} label="Pedidos" value={live.kitchenInPrep + live.kitchenReady} to="/restaurant/orders" />
            <Pill icon={QrCode} label="Mesas" value={`${live.tablesBusy}/${live.tablesTotal}`} to="/restaurant/tables" />
            <Pill icon={BellRing} label="Chamadas" value={live.openCalls} to="/restaurant/waiter-calls" pulse={live.openCalls > 0} />
            <Pill icon={Disc3} label="DJ" value={live.djQueued} to="/restaurant/dj" />
            <Pill icon={Truck} label="Drivers" value={`${live.driversOnline}/${live.driversOnline + live.driversBusy}`} to="/restaurant/deliveries" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* COL 1+2: Orders + Tables */}
          <div className="xl:col-span-2 space-y-4">
            {/* Pedidos ativos */}
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-warning" />
                  <h2 className="font-semibold text-sm">Pedidos ativos</h2>
                  <span className="text-xs text-muted-foreground">({filteredOrders.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  {(['all', 'delivery', 'pickup', 'dine_in'] as const).map(k => (
                    <button
                      key={k}
                      onClick={() => setTypeFilter(k)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        typeFilter === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {k === 'all' ? 'Todos' : k === 'delivery' ? 'Entrega' : k === 'pickup' ? 'Retirada' : 'Mesa'}
                    </button>
                  ))}
                  <Link to="/restaurant/orders" className="ml-2 text-xs text-primary hover:underline flex items-center gap-0.5">
                    Ver todos <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </header>
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido ativo agora.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredOrders.map(o => {
                    const can = !!statusFlow[o.status];
                    const old = (Date.now() - new Date(o.created_at).getTime()) / 60000 > 25;
                    return (
                      <li key={o.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${old ? 'bg-destructive/5' : ''}`}>
                        <span className="font-mono font-bold w-12 truncate">#{o.number}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          o.type === 'delivery' ? 'bg-accent/15 text-accent' :
                          o.type === 'pickup' ? 'bg-warning/15 text-warning' :
                          'bg-primary/15 text-primary'
                        }`}>
                          {o.type === 'delivery' ? 'ENT' : o.type === 'pickup' ? 'RET' : 'MESA'}
                        </span>
                        <span className="flex-1 truncate text-muted-foreground">{o.customer_name || '—'}</span>
                        <span className="hidden sm:inline text-xs text-muted-foreground">{elapsed(o.created_at)}</span>
                        <span className="font-semibold tabular-nums w-20 text-right">{fmt(Number(o.total))}</span>
                        <span className="hidden md:inline px-1.5 py-0.5 rounded text-[10px] bg-muted">{statusLabel[o.status] ?? o.status}</span>
                        {can && (
                          <button
                            onClick={() => advance(o.id, o.status)}
                            className="px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 flex items-center gap-0.5"
                            title={`Avançar para ${statusLabel[statusFlow[o.status]]}`}
                          >
                            <CheckCheck className="h-3 w-3" /> Avançar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Mesas ocupadas */}
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm">Mesas ocupadas</h2>
                  <span className="text-xs text-muted-foreground">({occupiedTables.length})</span>
                </div>
                <Link to="/restaurant/tables" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  Gerenciar <ArrowUpRight className="h-3 w-3" />
                </Link>
              </header>
              {occupiedTables.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Todas as mesas livres.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3">
                  {occupiedTables.map(t => (
                    <Link
                      key={t.id}
                      to="/restaurant/tables"
                      className="rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors p-2 text-center"
                    >
                      <div className="font-bold text-base">#{t.number}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{t.label || 'Mesa'}</div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* COL 3: Calls + KDS resume + shortcuts */}
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <BellRing className={`h-4 w-4 ${pendingCalls.length > 0 ? 'text-warning animate-pulse' : 'text-muted-foreground'}`} />
                  <h2 className="font-semibold text-sm">Chamadas de garçom</h2>
                </div>
                <span className="text-xs text-muted-foreground">{pendingCalls.length} pend.</span>
              </header>
              {pendingCalls.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma chamada.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {pendingCalls.map((c: any) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-mono font-bold w-12">#{c.table_number}</span>
                      <span className="flex-1 truncate text-xs text-muted-foreground">{c.message || c.type || 'chamada'}</span>
                      <span className="text-[10px] text-muted-foreground">{elapsed(c.created_at)}</span>
                      <button
                        onClick={() => ackCall(c.id)}
                        className="px-2 py-1 rounded bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20"
                      >
                        OK
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <h2 className="font-semibold text-sm flex items-center gap-2 mb-2">
                <UtensilsCrossed className="h-4 w-4 text-warning" />
                Cozinha (resumo)
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <KdsTile label="Em preparo" value={live.kitchenInPrep} tone="warning" />
                <KdsTile label="Prontos" value={live.kitchenReady} tone="success" />
              </div>
              <Link to="/restaurant/kitchen" className="mt-2 block text-center text-xs text-primary hover:underline">
                Abrir KDS completo →
              </Link>
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <h2 className="font-semibold text-sm mb-2">Atalhos rápidos</h2>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <Shortcut to="/restaurant/cashier" label="Caixa" />
                <Shortcut to="/restaurant/menu" label="Cardápio" />
                <Shortcut to="/restaurant/inventory" label="Estoque" />
                <Shortcut to="/restaurant/expenses" label="Despesas" />
                <Shortcut to="/restaurant/reports" label="Relatórios" />
                <Shortcut to="/restaurant/customers" label="Clientes" />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground text-center">Pressione <kbd className="px-1 py-0.5 rounded bg-muted">⌘K</kbd> para busca global</p>
            </section>
          </div>
        </div>
      </div>
    </RestaurantLayout>
  );
}

function Pill({ icon: Icon, label, value, to, pulse }: { icon: any; label: string; value: any; to: string; pulse?: boolean }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors ${pulse ? 'border-warning/50' : ''}`}
    >
      <Icon className={`h-3.5 w-3.5 ${pulse ? 'text-warning animate-pulse' : 'text-muted-foreground'}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
    </Link>
  );
}

function KdsTile({ label, value, tone }: { label: string; value: number; tone: 'warning' | 'success' }) {
  const cls = tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success';
  return (
    <div className={`rounded-lg p-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Shortcut({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded border border-border px-2 py-1.5 text-center hover:bg-muted/50 hover:border-primary/40 transition-colors"
    >
      {label}
    </Link>
  );
}
