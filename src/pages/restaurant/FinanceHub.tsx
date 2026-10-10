import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { useRestaurantOrders } from '@/hooks/useRestaurantData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Receipt, TrendingUp, TrendingDown, DollarSign, Users, Star, ArrowUpRight,
  Crown, AlertTriangle, BarChart3, Wallet, ShoppingBag,
} from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function FinanceHub() {
  const { restaurantId } = useAuth();
  const { data: orders = [] } = useRestaurantOrders(undefined, 'today');

  // Yesterday for delta
  const { data: yOrders = [] } = useQuery({
    queryKey: ['finance-hub-y', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from('orders')
        .select('total,status')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      return data ?? [];
    },
  });

  // Recent expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['finance-hub-exp', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('expenses' as any)
        .select('id,description,amount,due_date,paid,category')
        .eq('restaurant_id', restaurantId!)
        .gte('due_date', monthStart.toISOString().slice(0, 10))
        .order('due_date', { ascending: false })
        .limit(8);
      return (data ?? []) as any[];
    },
  });

  // Top customers (lifetime)
  const { data: topCustomers = [] } = useQuery({
    queryKey: ['finance-hub-cust', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('customers' as any)
        .select('id,name,phone,total_spent,total_orders')
        .eq('restaurant_id', restaurantId!)
        .order('total_spent', { ascending: false })
        .limit(5);
      return (data ?? []) as any[];
    },
  });

  // Top products today
  const todayPaid = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);
  const revenueToday = todayPaid.reduce((s, o) => s + Number(o.total), 0);
  const ordersToday = todayPaid.length;
  const ticketToday = ordersToday > 0 ? revenueToday / ordersToday : 0;

  const yPaid = yOrders.filter((o: any) => o.status === 'completed');
  const revenueY = yPaid.reduce((s: number, o: any) => s + Number(o.total), 0);
  const deltaPct = revenueY > 0 ? ((revenueToday - revenueY) / revenueY) * 100 : 0;

  const expensesMonth = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const unpaid = expenses.filter(e => !e.paid);
  const unpaidTotal = unpaid.reduce((s, e) => s + Number(e.amount || 0), 0);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    todayPaid.forEach((o: any) => {
      (o.order_items || []).forEach((it: any) => {
        const k = it.product_name || it.name || 'Item';
        const cur = map.get(k) || { name: k, qty: 0, total: 0 };
        cur.qty += it.quantity || 1;
        cur.total += Number(it.unit_price || 0) * (it.quantity || 1);
        map.set(k, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [todayPaid]);

  return (
    <RestaurantLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-border">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Hub Financeiro
            </h1>
            <p className="text-xs text-muted-foreground">Receita, despesas, ticket médio e top clientes em uma tela.</p>
          </div>
          <div className="flex gap-2 text-xs">
            <Link to="/restaurant/expenses" className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50">Despesas</Link>
            <Link to="/restaurant/reports" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90">Relatórios →</Link>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={DollarSign} label="Receita hoje" value={fmt(revenueToday)} delta={deltaPct} tone="primary" />
          <Kpi icon={ShoppingBag} label="Pedidos" value={ordersToday.toString()} tone="accent" />
          <Kpi icon={TrendingUp} label="Ticket médio" value={fmt(ticketToday)} tone="success" />
          <Kpi icon={Receipt} label="Despesas/mês" value={fmt(expensesMonth)} sub={unpaidTotal > 0 ? `${fmt(unpaidTotal)} a pagar` : 'tudo em dia'} tone={unpaidTotal > 0 ? 'warning' : 'muted'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Despesas recentes */}
          <section className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-warning" />
                <h2 className="font-semibold text-sm">Despesas do mês</h2>
              </div>
              <Link to="/restaurant/expenses" className="text-xs text-primary hover:underline flex items-center gap-0.5">Gerenciar <ArrowUpRight className="h-3 w-3" /></Link>
            </header>
            {expenses.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma despesa registrada este mês.</div>
            ) : (
              <ul className="divide-y divide-border">
                {expenses.map(e => (
                  <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {!e.paid && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                    <span className="flex-1 truncate">{e.description}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden sm:inline">{e.category || '—'}</span>
                    <span className="text-xs text-muted-foreground hidden md:inline">{e.due_date}</span>
                    <span className={`font-bold tabular-nums w-24 text-right ${e.paid ? '' : 'text-warning'}`}>{fmt(Number(e.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Top customers */}
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Top clientes</h2>
              </div>
              <Link to="/restaurant/customers" className="text-xs text-primary hover:underline flex items-center gap-0.5">CRM <ArrowUpRight className="h-3 w-3" /></Link>
            </header>
            {topCustomers.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sem clientes cadastrados.</div>
            ) : (
              <ul className="divide-y divide-border">
                {topCustomers.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">{c.total_orders}× pedidos</div>
                    </div>
                    <span className="font-bold tabular-nums text-xs">{fmt(Number(c.total_spent || 0))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Top products + atalhos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-warning" />
                <h2 className="font-semibold text-sm">Top produtos hoje</h2>
              </div>
            </header>
            {topProducts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Ainda sem vendas hoje.</div>
            ) : (
              <ul className="divide-y divide-border">
                {topProducts.map((p, i) => {
                  const max = topProducts[0].qty || 1;
                  const pct = (p.qty / max) * 100;
                  return (
                    <li key={p.name} className="px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{p.qty}×</span>
                        <span className="font-bold tabular-nums w-20 text-right">{fmt(p.total)}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-3">
            <h2 className="font-semibold text-sm mb-2">Atalhos</h2>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <Sc to="/restaurant/billing" label="Assinatura" icon={Wallet} />
              <Sc to="/restaurant/coupons" label="Cupons" icon={Star} />
              <Sc to="/restaurant/feedback" label="NPS" icon={Star} />
              <Sc to="/restaurant/customers" label="Clientes" icon={Users} />
              <Sc to="/restaurant/reports" label="Relatórios" icon={BarChart3} />
              <Sc to="/restaurant/expenses" label="Despesas" icon={Receipt} />
            </div>
          </section>
        </div>
      </div>
    </RestaurantLayout>
  );
}

function Kpi({ icon: Icon, label, value, sub, delta, tone }: { icon: any; label: string; value: string; sub?: string; delta?: number; tone: 'primary' | 'accent' | 'success' | 'warning' | 'muted' }) {
  const toneCls = {
    primary: 'border-primary/30 bg-primary/5',
    accent: 'border-accent/30 bg-accent/5',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    muted: 'border-border bg-card',
  }[tone];
  return (
    <div className={`rounded-xl border ${toneCls} p-3`}>
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {delta !== undefined && (
          <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${delta >= 0 ? 'text-success' : 'text-destructive'}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Sc({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <Link to={to} className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5 hover:bg-muted/50 hover:border-primary/40 transition-colors">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
