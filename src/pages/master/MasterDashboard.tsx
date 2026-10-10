import { Store, TrendingUp, ShoppingBag, DollarSign, AlertTriangle } from 'lucide-react';
import MasterLayout from '@/components/layout/MasterLayout';
import MetricCard from '@/components/MetricCard';
import ScrollReveal from '@/components/ScrollReveal';
import { useMasterMetrics, useMasterRestaurants } from '@/hooks/useRestaurantData';

const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const statusLabels: Record<string, { label: string; class: string }> = {
  active: { label: 'Ativo', class: 'bg-success/10 text-success' },
  trial: { label: 'Trial', class: 'bg-primary/10 text-primary' },
  overdue: { label: 'Inadimplente', class: 'bg-destructive/10 text-destructive' },
  suspended: { label: 'Suspenso', class: 'bg-warning/10 text-warning' },
  cancelled: { label: 'Cancelado', class: 'bg-muted text-muted-foreground' },
};

export default function MasterDashboard() {
  const { data: metrics } = useMasterMetrics();
  const { data: restaurants = [], isLoading } = useMasterRestaurants();

  const alerts = restaurants.filter(r => r.status === 'overdue' || r.status === 'suspended');

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div>
            <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão geral da plataforma Bora Uai</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Restaurantes ativos', value: metrics?.activeRestaurants ?? 0, icon: Store },
            { label: 'Pedidos hoje', value: metrics?.ordersToday ?? 0, icon: ShoppingBag },
            { label: 'Faturamento hoje', value: formatCurrency(metrics?.revenueToday ?? 0), icon: DollarSign },
            { label: 'Receita recorrente', value: formatCurrency(metrics?.mrr ?? 0), icon: TrendingUp },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 60}>
              <MetricCard {...m} />
            </ScrollReveal>
          ))}
        </div>

        {alerts.length > 0 && (
          <ScrollReveal>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold text-base mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Alertas
              </h3>
              <div className="space-y-2">
                {alerts.map(r => {
                  const s = statusLabels[r.status];
                  return (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                      <div>
                        <span className="font-medium">{r.name}</span>
                        <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.class}`}>{s.label}</span>
                      </div>
                      <span className="text-muted-foreground">{r.city}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal>
          <div className="card-elevated">
            <div className="flex items-center justify-between p-5 pb-3">
              <h3 className="font-heading font-semibold text-base">Restaurantes</h3>
              <a href="/master/restaurants" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">Ver todos →</a>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 py-3">Restaurante</th>
                      <th className="text-left font-medium px-5 py-3 hidden sm:table-cell">Plano</th>
                      <th className="text-left font-medium px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restaurants.map(r => {
                      const s = statusLabels[r.status] || statusLabels.active;
                      const sub = (r.subscriptions as any)?.[0];
                      const plan = sub?.subscription_plans;
                      return (
                        <tr key={r.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3">
                            <div>
                              <p className="font-medium">{r.name}</p>
                              <p className="text-xs text-muted-foreground">{r.city}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell text-muted-foreground">{plan?.name || '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.class}`}>{s.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </MasterLayout>
  );
}
