import { FileText, Download, BarChart3, TrendingUp, Calendar, Search } from 'lucide-react';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function ReportsPage() {
  const [restaurantFilter, setRestaurantFilter] = useState('');
  const [period, setPeriod] = useState('30');

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants-reports'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurants').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report-data', restaurantFilter, period],
    queryFn: async () => {
      const daysAgo = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString();

      let ordersQuery = supabase.from('orders').select('id, total, status, restaurant_id, created_at, type').gte('created_at', daysAgo);
      if (restaurantFilter) ordersQuery = ordersQuery.eq('restaurant_id', restaurantFilter);

      let transQuery = supabase.from('financial_transactions').select('amount, type, restaurant_id').gte('created_at', daysAgo);
      if (restaurantFilter) transQuery = transQuery.eq('restaurant_id', restaurantFilter);

      const [ordersRes, transRes, restaurantsRes] = await Promise.all([
        ordersQuery,
        transQuery,
        supabase.from('restaurants').select('id, name'),
      ]);

      const orders = ordersRes.data || [];
      const trans = transRes.data || [];
      const rests = restaurantsRes.data || [];

      const totalOrders = orders.length;
      const completedOrders = orders.filter(o => o.status === 'completed').length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      const totalRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + Number(o.total), 0);
      const avgTicket = completedOrders > 0 ? totalRevenue / completedOrders : 0;
      const deliveryOrders = orders.filter(o => o.type === 'delivery').length;
      const dineInOrders = orders.filter(o => o.type === 'dine_in').length;
      const pickupOrders = orders.filter(o => o.type === 'pickup').length;

      // Per restaurant breakdown
      const perRestaurant = rests.map(r => {
        const rOrders = orders.filter(o => o.restaurant_id === r.id);
        const rCompleted = rOrders.filter(o => o.status === 'completed');
        const rRevenue = rCompleted.reduce((s, o) => s + Number(o.total), 0);
        return {
          id: r.id,
          name: r.name,
          orders: rOrders.length,
          completed: rCompleted.length,
          cancelled: rOrders.filter(o => o.status === 'cancelled').length,
          revenue: rRevenue,
          avgTicket: rCompleted.length > 0 ? rRevenue / rCompleted.length : 0,
        };
      }).filter(r => r.orders > 0).sort((a, b) => b.revenue - a.revenue);

      const platformFees = trans.filter(t => t.type === 'platform_fee').reduce((s, t) => s + Number(t.amount), 0);

      return { totalOrders, completedOrders, cancelledOrders, totalRevenue, avgTicket, deliveryOrders, dineInOrders, pickupOrders, perRestaurant, platformFees };
    },
  });

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold">Relatórios</h1>
              <p className="text-sm text-muted-foreground">Análises detalhadas por restaurante e período</p>
            </div>
            <button onClick={() => {
              if (!reportData) return;
              const rows = ['Restaurante,Pedidos,Concluídos,Cancelados,Receita,Ticket Médio'];
              (reportData.perRestaurant || []).forEach(r => {
                rows.push(`"${r.name}",${r.orders},${r.completed},${r.cancelled},"${r.revenue.toFixed(2)}","${r.avgTicket.toFixed(2)}"`);
              });
              rows.push('');
              rows.push(`Total,${reportData.totalOrders},${reportData.completedOrders},${reportData.cancelledOrders},"${reportData.totalRevenue.toFixed(2)}","${reportData.avgTicket.toFixed(2)}"`);
              const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `relatorio-${period}dias-${new Date().toISOString().split('T')[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
            }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Download className="h-4 w-4" /> Exportar
            </button>
          </div>
        </ScrollReveal>

        {/* Filters */}
        <ScrollReveal>
          <div className="card-elevated p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Restaurante</label>
              <select value={restaurantFilter} onChange={e => setRestaurantFilter(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Todos os restaurantes</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-48">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
              <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="7">Últimos 7 dias</option>
                <option value="15">Últimos 15 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="60">Últimos 60 dias</option>
                <option value="90">Últimos 90 dias</option>
              </select>
            </div>
          </div>
        </ScrollReveal>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total de pedidos', value: isLoading ? '...' : reportData?.totalOrders || 0 },
            { label: 'Receita total', value: isLoading ? '...' : fmt(reportData?.totalRevenue || 0) },
            { label: 'Ticket médio', value: isLoading ? '...' : fmt(reportData?.avgTicket || 0) },
            { label: 'Taxa de cancelamento', value: isLoading ? '...' : `${reportData?.totalOrders ? Math.round((reportData.cancelledOrders / reportData.totalOrders) * 100) : 0}%` },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 60}>
              <div className="card-elevated p-4">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-heading font-bold mt-1">{m.value}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Order types */}
        <ScrollReveal>
          <div className="card-elevated p-5">
            <h3 className="font-heading font-semibold text-base mb-4">Pedidos por tipo</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Delivery', value: reportData?.deliveryOrders || 0, color: 'bg-primary/10 text-primary' },
                { label: 'Mesa (Dine-in)', value: reportData?.dineInOrders || 0, color: 'bg-success/10 text-success' },
                { label: 'Retirada', value: reportData?.pickupOrders || 0, color: 'bg-warning/10 text-warning' },
              ].map((t, i) => (
                <div key={i} className={`rounded-xl p-4 ${t.color}`}>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-2xl font-heading font-bold mt-1">{t.value}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Per restaurant */}
        <ScrollReveal>
          <div className="card-elevated">
            <div className="p-5 pb-3">
              <h3 className="font-heading font-semibold text-base">Desempenho por restaurante</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-border text-muted-foreground">
                    <th className="text-left font-medium px-5 py-3">Restaurante</th>
                    <th className="text-right font-medium px-5 py-3">Pedidos</th>
                    <th className="text-right font-medium px-5 py-3">Concluídos</th>
                    <th className="text-right font-medium px-5 py-3 hidden sm:table-cell">Cancelados</th>
                    <th className="text-right font-medium px-5 py-3">Receita</th>
                    <th className="text-right font-medium px-5 py-3 hidden md:table-cell">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
                  ) : (reportData?.perRestaurant || []).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sem dados para o período</td></tr>
                  ) : (reportData?.perRestaurant || []).map(r => (
                    <tr key={r.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{r.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{r.orders}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-success">{r.completed}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-destructive hidden sm:table-cell">{r.cancelled}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{fmt(r.revenue)}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground tabular-nums hidden md:table-cell">{fmt(r.avgTicket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </MasterLayout>
  );
}
