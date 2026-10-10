import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import MetricCard from '@/components/MetricCard';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Users, AlertTriangle, Repeat, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend
} from 'recharts';
import { Link } from 'react-router-dom';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

function useSaasMetrics() {
  return useQuery({
    queryKey: ['saas-metrics'],
    queryFn: async () => {
      const [restaurantsRes, subsRes, plansRes, paymentsRes, historyRes] = await Promise.all([
        supabase.from('restaurants').select('id, name, status, created_at, owner_id'),
        supabase.from('subscriptions').select('id, restaurant_id, plan_id, status, monthly_price, current_period_end, trial_ends_at, last_payment_at, created_at'),
        supabase.from('subscription_plans').select('id, name, price, tier'),
        supabase.from('subscription_payments').select('id, amount, status, paid_at, restaurant_id, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('subscription_plan_history').select('id, restaurant_id, from_status, to_status, created_at').order('created_at', { ascending: false }).limit(500),
      ]);
      if (restaurantsRes.error) throw restaurantsRes.error;
      if (subsRes.error) throw subsRes.error;
      if (plansRes.error) throw plansRes.error;

      const restaurants = restaurantsRes.data || [];
      const subs = subsRes.data || [];
      const plans = plansRes.data || [];
      const payments = paymentsRes.data || [];
      const history = historyRes.data || [];

      const planMap = Object.fromEntries(plans.map(p => [p.id, p]));
      const restMap = Object.fromEntries(restaurants.map(r => [r.id, r]));

      // MRR — soma dos planos das assinaturas ativas
      const activeSubs = subs.filter(s => s.status === 'active');
      const mrr = activeSubs.reduce((acc, s) => acc + Number(s.monthly_price || planMap[s.plan_id]?.price || 0), 0);
      const arpu = activeSubs.length > 0 ? mrr / activeSubs.length : 0;
      const arr = mrr * 12;

      // Distribuição por plano
      const planDistribution = plans.map(p => ({
        name: p.name,
        value: activeSubs.filter(s => s.plan_id === p.id).length,
        revenue: activeSubs.filter(s => s.plan_id === p.id).reduce((a, s) => a + Number(s.monthly_price || p.price || 0), 0),
      })).filter(p => p.value > 0);

      // Status geral
      const statusBreakdown = {
        active: restaurants.filter(r => r.status === 'active').length,
        trial: restaurants.filter(r => r.status === 'trial').length,
        overdue: restaurants.filter(r => r.status === 'overdue').length,
        suspended: restaurants.filter(r => r.status === 'suspended').length,
        cancelled: restaurants.filter(r => r.status === 'cancelled').length,
      };

      // Crescimento mensal (últimos 6 meses)
      const now = new Date();
      const monthly: { month: string; novos: number; cancelados: number; mrr: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const label = d.toLocaleDateString('pt-BR', { month: 'short' });
        const novos = restaurants.filter(r => {
          const c = new Date(r.created_at);
          return c >= d && c < next;
        }).length;
        const cancelados = history.filter(h => {
          const c = new Date(h.created_at);
          return c >= d && c < next && (h.to_status === 'cancelled' || h.to_status === 'suspended');
        }).length;
        // MRR acumulado naquele mês — soma de subs ativas com created_at <= próximo mês
        const mrrMes = subs
          .filter(s => new Date(s.created_at) < next && s.status === 'active')
          .reduce((a, s) => a + Number(s.monthly_price || planMap[s.plan_id]?.price || 0), 0);
        monthly.push({ month: label, novos, cancelados, mrr: mrrMes });
      }

      // Churn mensal (cancelados / ativos no início do mês)
      const lastMonth = monthly[monthly.length - 1];
      const prevMonth = monthly[monthly.length - 2];
      const churn = prevMonth && (statusBreakdown.active + lastMonth.cancelados) > 0
        ? (lastMonth.cancelados / (statusBreakdown.active + lastMonth.cancelados)) * 100
        : 0;

      // Funil trial → ativo
      const trialNow = restaurants.filter(r => r.status === 'trial').length;
      const everTrials = restaurants.length; // todo restaurante começa em trial
      const conversion = everTrials > 0 ? (statusBreakdown.active / everTrials) * 100 : 0;

      // Trials expirando em ≤7 dias
      const trialsExpiringSoon = subs.filter(s => {
        if (!s.trial_ends_at) return false;
        const t = new Date(s.trial_ends_at);
        const diff = (t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 7;
      }).map(s => ({ ...s, restaurant: restMap[s.restaurant_id] }));

      // Top restaurantes em risco (overdue + valor)
      const atRisk = subs
        .filter(s => s.status === 'overdue' || (s.current_period_end && new Date(s.current_period_end) < now))
        .map(s => ({
          ...s,
          restaurant: restMap[s.restaurant_id],
          plan: planMap[s.plan_id],
        }))
        .filter(s => s.restaurant)
        .sort((a, b) => Number(b.monthly_price || 0) - Number(a.monthly_price || 0))
        .slice(0, 10);

      // Receita recebida (últimos 30 dias)
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const revenue30 = payments
        .filter(p => p.status === 'approved' && p.paid_at && new Date(p.paid_at) >= d30)
        .reduce((a, p) => a + Number(p.amount || 0), 0);

      // LTV simples = ARPU / churn (mensal)
      const ltv = churn > 0 ? arpu / (churn / 100) : arpu * 24;

      return {
        mrr, arr, arpu, ltv,
        activeCount: statusBreakdown.active,
        trialCount: trialNow,
        overdueCount: statusBreakdown.overdue,
        suspendedCount: statusBreakdown.suspended,
        cancelledCount: statusBreakdown.cancelled,
        churn,
        conversion,
        revenue30,
        planDistribution,
        monthly,
        trialsExpiringSoon,
        atRisk,
      };
    },
    staleTime: 60_000,
  });
}

export default function SaasMetricsPage() {
  const { data, isLoading } = useSaasMetrics();

  const cards = useMemo(() => [
    { label: 'MRR (Receita Recorrente)', value: fmt(data?.mrr ?? 0), icon: Repeat, iconColor: 'text-primary' },
    { label: 'ARR (Anualizada)', value: fmt(data?.arr ?? 0), icon: TrendingUp, iconColor: 'text-success' },
    { label: 'ARPU (Ticket médio/mês)', value: fmt(data?.arpu ?? 0), icon: Zap, iconColor: 'text-primary' },
    { label: 'LTV estimado', value: fmt(data?.ltv ?? 0), icon: TrendingUp, iconColor: 'text-success' },
    { label: 'Restaurantes ativos', value: data?.activeCount ?? 0, icon: Users, iconColor: 'text-primary' },
    { label: 'Em trial', value: data?.trialCount ?? 0, icon: Users, iconColor: 'text-warning' },
    { label: 'Inadimplentes', value: data?.overdueCount ?? 0, icon: AlertTriangle, iconColor: 'text-destructive' },
    { label: 'Churn mensal', value: `${(data?.churn ?? 0).toFixed(1)}%`, icon: TrendingDown, iconColor: 'text-destructive' },
  ], [data]);

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div>
            <h1 className="font-heading text-2xl font-bold">Métricas SaaS</h1>
            <p className="text-sm text-muted-foreground">MRR, churn, conversão e saúde da carteira</p>
          </div>
        </ScrollReveal>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Calculando métricas...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((m, i) => (
                <ScrollReveal key={i} delay={i * 40}>
                  <MetricCard {...m} />
                </ScrollReveal>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">MRR — últimos 6 meses</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data?.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v: number) => fmt(v)} />
                      <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Novos x Cancelados / mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data?.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="novos" fill="hsl(var(--success))" name="Novos" radius={[4,4,0,0]} />
                      <Bar dataKey="cancelados" fill="hsl(var(--destructive))" name="Cancelados/Suspensos" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por plano</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.planDistribution?.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={data.planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: { name: string; value: number }) => `${e.name} (${e.value})`}>
                          {data.planDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-12 text-center">Sem assinaturas ativas ainda</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Funil Trial → Ativo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Conversão de trial</span>
                      <span className="font-bold text-primary">{data?.conversion.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(100, data?.conversion ?? 0)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-warning/10 p-3">
                      <p className="text-2xl font-bold text-warning">{data?.trialCount}</p>
                      <p className="text-xs text-muted-foreground">Em trial</p>
                    </div>
                    <div className="rounded-lg bg-success/10 p-3">
                      <p className="text-2xl font-bold text-success">{data?.activeCount}</p>
                      <p className="text-xs text-muted-foreground">Ativos</p>
                    </div>
                    <div className="rounded-lg bg-destructive/10 p-3">
                      <p className="text-2xl font-bold text-destructive">{(data?.cancelledCount ?? 0) + (data?.suspendedCount ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">Perdidos</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-primary/5 p-3 text-sm">
                    Receita recebida (30 dias): <span className="font-bold text-primary">{fmt(data?.revenue30 ?? 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Trials expirando em ≤ 7 dias ({data?.trialsExpiringSoon.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.trialsExpiringSoon.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum trial expirando em breve.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {data?.trialsExpiringSoon.map((t: any) => {
                      const days = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                          <span className="font-medium">{t.restaurant?.name || '—'}</span>
                          <span className={`font-medium ${days <= 2 ? 'text-destructive' : 'text-warning'}`}>
                            {days}d restantes
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Top contas em risco (inadimplência)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.atRisk.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma conta em risco. 🎉</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left font-medium py-2">Restaurante</th>
                          <th className="text-left font-medium py-2 hidden sm:table-cell">Plano</th>
                          <th className="text-right font-medium py-2">Mensalidade</th>
                          <th className="text-right font-medium py-2">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.atRisk.map((s: any) => (
                          <tr key={s.id} className="border-b border-border/60">
                            <td className="py-2 font-medium">{s.restaurant?.name}</td>
                            <td className="py-2 hidden sm:table-cell text-muted-foreground">{s.plan?.name || '—'}</td>
                            <td className="py-2 text-right">{fmt(Number(s.monthly_price || 0))}</td>
                            <td className="py-2 text-right">
                              <Link to="/master/inadimplencia" className="text-primary hover:underline">Cobrar →</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MasterLayout>
  );
}
