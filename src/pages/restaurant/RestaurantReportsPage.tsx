import { Download, DollarSign, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import MetricCard from '@/components/MetricCard';
import ScrollReveal from '@/components/ScrollReveal';
import { useState, useMemo } from 'react';
import { useRestaurantOrders } from '@/hooks/useRestaurantData';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function RestaurantReportsPage() {
  const [period, setPeriod] = useState('week');
  const [typeFilter, setTypeFilter] = useState('all');
  const { restaurantId } = useAuth();
  const { data: allOrders = [] } = useRestaurantOrders();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-count', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase.from('customers').select('id, created_at').eq('restaurant_id', restaurantId);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const stats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    if (period === 'today') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === 'week') { startDate = new Date(now); startDate.setDate(now.getDate() - 7); }
    else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else { startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); }

    let orders = allOrders.filter(o => new Date(o.created_at) >= startDate && o.status !== 'cancelled');
    if (typeFilter !== 'all') orders = orders.filter(o => o.type === typeFilter);
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const avgTicket = orders.length > 0 ? revenue / orders.length : 0;
    const newCustomers = customers.filter(c => new Date(c.created_at) >= startDate).length;

    // daily breakdown
    const dailyMap = new Map<string, { orders: number; revenue: number }>();
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    orders.forEach(o => {
      const d = new Date(o.created_at);
      const key = d.toISOString().split('T')[0];
      const existing = dailyMap.get(key) || { orders: 0, revenue: 0 };
      dailyMap.set(key, { orders: existing.orders + 1, revenue: existing.revenue + Number(o.total) });
    });
    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, val]) => ({ day: dayNames[new Date(date).getDay()], ...val }));

    // top products
    const productMap = new Map<string, { qty: number; revenue: number }>();
    orders.forEach(o => (o.order_items || []).forEach((item: any) => {
      const existing = productMap.get(item.name) || { qty: 0, revenue: 0 };
      productMap.set(item.name, { qty: existing.qty + item.qty, revenue: existing.revenue + Number(item.total_price) });
    }));
    const topProducts = Array.from(productMap.entries())
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // type breakdown
    const typeCount = { delivery: 0, pickup: 0, dine_in: 0 };
    orders.forEach(o => { if (o.type in typeCount) typeCount[o.type as keyof typeof typeCount]++; });
    const total = orders.length || 1;

    return { revenue, count: orders.length, avgTicket, newCustomers, dailyData, topProducts, typeCount, total };
  }, [allOrders, customers, period, typeFilter]);

  const maxRevenue = Math.max(...stats.dailyData.map(d => d.revenue), 1);

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold">Relatórios</h1>
              <p className="text-sm text-muted-foreground">Análise de desempenho do seu restaurante</p>
            </div>
            <div className="flex gap-2">
              <select value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="today">Hoje</option>
                <option value="week">Última semana</option>
                <option value="month">Este mês</option>
                <option value="quarter">Trimestre</option>
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="all">Todos os tipos</option>
                <option value="delivery">Delivery</option>
                <option value="pickup">Retirada</option>
                <option value="dine_in">Mesa</option>
              </select>
              <button onClick={() => {
                const now = new Date();
                let startDate: Date;
                if (period === 'today') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                else if (period === 'week') { startDate = new Date(now); startDate.setDate(now.getDate() - 7); }
                else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                else { startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); }
                const filtered = allOrders.filter(o => new Date(o.created_at) >= startDate);
                const headers = 'Pedido,Data,Tipo,Cliente,Total,Status\n';
                const rows = filtered.map(o =>
                  `#${o.number},${new Date(o.created_at).toLocaleDateString('pt-BR')},${o.type},${o.customer_name},${Number(o.total).toFixed(2)},${o.status}`
                ).join('\n');
                const blob = new Blob([headers + rows], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `relatorio-${period}-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                <Download className="h-4 w-4" /> Exportar CSV
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Faturamento', value: fmt(stats.revenue), icon: DollarSign, change: `${stats.count} pedidos`, changeType: 'positive' as const },
            { label: 'Pedidos', value: stats.count, icon: ShoppingBag, change: 'no período', changeType: 'neutral' as const },
            { label: 'Ticket médio', value: fmt(stats.avgTicket), icon: TrendingUp, change: 'por pedido', changeType: 'neutral' as const },
            { label: 'Novos clientes', value: stats.newCustomers, icon: Users, change: 'no período', changeType: 'positive' as const },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 60}><MetricCard {...m} /></ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold text-base mb-4">Faturamento diário</h3>
            {stats.dailyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {stats.dailyData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium tabular-nums">{fmt(d.revenue)}</span>
                    <div className="w-full rounded-t-lg bg-primary/80 hover:bg-primary transition-colors" style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: 4 }} />
                    <span className="text-xs text-muted-foreground">{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ScrollReveal>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold text-base mb-4">Produtos mais vendidos</h3>
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {stats.topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.qty} vendidos</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium tabular-nums">{fmt(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold text-base mb-4">Pedidos por tipo</h3>
              <div className="space-y-4">
                {[
                  { label: 'Delivery', value: stats.typeCount.delivery, cls: 'bg-primary' },
                  { label: 'Retirada', value: stats.typeCount.pickup, cls: 'bg-success' },
                  { label: 'Mesa', value: stats.typeCount.dine_in, cls: 'bg-accent' },
                ].map(t => {
                  const pct = Math.round((t.value / stats.total) * 100);
                  return (
                    <div key={t.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground">{t.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className={`h-2 rounded-full ${t.cls} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </RestaurantLayout>
  );
}
