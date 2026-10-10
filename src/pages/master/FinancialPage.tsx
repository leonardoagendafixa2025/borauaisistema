import { DollarSign, TrendingUp, TrendingDown, Download, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';
import MasterLayout from '@/components/layout/MasterLayout';
import MetricCard from '@/components/MetricCard';
import ScrollReveal from '@/components/ScrollReveal';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function useFinancialData() {
  return useQuery({
    queryKey: ['master-financial'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

      const [subsActive, transThisMonth, transLastMonth, overdueRes, allSubs] = await Promise.all([
        supabase.from('subscriptions').select('monthly_price').eq('status', 'active'),
        supabase.from('financial_transactions').select('*, restaurants(name)').gte('created_at', startOfMonth).order('created_at', { ascending: false }),
        supabase.from('financial_transactions').select('amount').gte('created_at', lastMonth).lte('created_at', endLastMonth),
        supabase.from('subscriptions').select('monthly_price, restaurants(name)').eq('status', 'overdue'),
        supabase.from('subscriptions').select('*, restaurants(name), subscription_plans(name)').order('created_at', { ascending: false }),
      ]);

      const mrr = subsActive.data?.reduce((s, sub) => s + Number(sub.monthly_price), 0) || 0;
      const revenueThisMonth = transThisMonth.data?.reduce((s, t) => s + Number(t.amount), 0) || 0;
      const revenueLastMonth = transLastMonth.data?.reduce((s, t) => s + Number(t.amount), 0) || 0;
      const overdue = overdueRes.data?.reduce((s, o) => s + Number(o.monthly_price), 0) || 0;
      const platformFees = transThisMonth.data?.filter(t => t.type === 'platform_fee').reduce((s, t) => s + Number(t.amount), 0) || 0;

      return {
        mrr, revenueThisMonth, revenueLastMonth, overdue,
        overdueCount: overdueRes.data?.length || 0,
        overdueRestaurants: overdueRes.data || [],
        platformFees,
        transactions: transThisMonth.data || [],
        subscriptions: allSubs.data || [],
      };
    },
  });
}

export default function FinancialPage() {
  const [filter, setFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('');
  const [tab, setTab] = useState<'transactions' | 'subscriptions' | 'overdue'>('transactions');
  const { data, isLoading } = useFinancialData();

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants-list-fin'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurants').select('id, name').order('name');
      return data || [];
    },
  });

  const transactions = data?.transactions || [];
  const filtered = transactions.filter(t => {
    if (filter !== 'all') {
      if (filter === 'paid' && t.type !== 'subscription') return false;
      if (filter === 'platform_fee' && t.type !== 'platform_fee') return false;
    }
    if (restaurantFilter && t.restaurant_id !== restaurantFilter) return false;
    return true;
  });

  const changePercent = data && data.revenueLastMonth > 0
    ? Math.round(((data.revenueThisMonth - data.revenueLastMonth) / data.revenueLastMonth) * 100) : 0;

  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: 'Ativo', cls: 'bg-success/10 text-success' },
    trial: { label: 'Trial', cls: 'bg-primary/10 text-primary' },
    overdue: { label: 'Inadimplente', cls: 'bg-destructive/10 text-destructive' },
    suspended: { label: 'Suspenso', cls: 'bg-warning/10 text-warning' },
    cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
  };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold">Financeiro</h1>
              <p className="text-sm text-muted-foreground">Receitas, taxas, comissões e inadimplência</p>
            </div>
            <button onClick={() => {
              const rows = ['Restaurante,Tipo,Descrição,Valor,Data'];
              filtered.forEach(t => {
                rows.push(`"${(t as any).restaurants?.name || ''}","${t.type}","${t.description || ''}","${Number(t.amount).toFixed(2)}","${new Date(t.created_at).toLocaleDateString('pt-BR')}"`);
              });
              const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `financeiro-${new Date().toISOString().split('T')[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
              toast.success('CSV exportado com sucesso');
            }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            const ct1: 'positive' | 'negative' = changePercent >= 0 ? 'positive' : 'negative';
            const ct3: 'negative' | 'neutral' = data?.overdueCount ? 'negative' : 'neutral';
            return [
              { label: 'MRR', value: isLoading ? '...' : fmt(data?.mrr || 0), icon: TrendingUp, change: `${changePercent >= 0 ? '+' : ''}${changePercent}% vs mês anterior`, changeType: ct1 },
              { label: 'Receita este mês', value: isLoading ? '...' : fmt(data?.revenueThisMonth || 0), icon: DollarSign, change: `${transactions.length} transações`, changeType: 'neutral' as const },
              { label: 'Inadimplência', value: isLoading ? '...' : fmt(data?.overdue || 0), icon: TrendingDown, change: `${data?.overdueCount || 0} restaurantes`, changeType: ct3 },
              { label: 'Taxas plataforma', value: isLoading ? '...' : fmt(data?.platformFees || 0), icon: TrendingUp, change: 'Acumulado no mês', changeType: 'neutral' as const },
            ];
          })().map((m, i) => (
            <ScrollReveal key={i} delay={i * 60}><MetricCard {...m} /></ScrollReveal>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button onClick={() => setTab('transactions')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'transactions' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Transações</button>
          <button onClick={() => setTab('subscriptions')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'subscriptions' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Cobranças</button>
          <button onClick={() => setTab('overdue')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'overdue' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
            Inadimplentes {data?.overdueCount ? <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">{data.overdueCount}</span> : null}
          </button>
        </div>

        {tab === 'transactions' && (
          <ScrollReveal>
            <div className="card-elevated">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 pb-3 gap-3">
                <h3 className="font-heading font-semibold text-base">Transações do mês</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={restaurantFilter} onChange={e => setRestaurantFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                    <option value="">Todos restaurantes</option>
                    {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                    <option value="all">Todos tipos</option>
                    <option value="paid">Assinaturas</option>
                    <option value="platform_fee">Taxas plataforma</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 py-3">Restaurante</th>
                      <th className="text-left font-medium px-5 py-3">Tipo</th>
                      <th className="text-left font-medium px-5 py-3 hidden sm:table-cell">Descrição</th>
                      <th className="text-right font-medium px-5 py-3">Valor</th>
                      <th className="text-right font-medium px-5 py-3 hidden md:table-cell">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma transação</td></tr>
                    ) : filtered.map(t => (
                      <tr key={t.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium">{(t as any).restaurants?.name || '—'}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${t.type === 'subscription' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}>
                            {t.type === 'subscription' ? 'Assinatura' : t.type === 'platform_fee' ? 'Taxa' : t.type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{t.description || '—'}</td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">{fmt(Number(t.amount))}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground hidden md:table-cell">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        )}

        {tab === 'subscriptions' && (
          <ScrollReveal>
            <div className="card-elevated">
              <div className="p-5 pb-3">
                <h3 className="font-heading font-semibold text-base">Cobranças de assinaturas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 py-3">Restaurante</th>
                      <th className="text-left font-medium px-5 py-3">Plano</th>
                      <th className="text-left font-medium px-5 py-3">Status</th>
                      <th className="text-right font-medium px-5 py-3">Valor</th>
                      <th className="text-right font-medium px-5 py-3 hidden md:table-cell">Próx. cobrança</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.subscriptions || []).map(s => {
                      const st = statusMap[s.status] || statusMap.active;
                      return (
                        <tr key={s.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-medium">{(s as any).restaurants?.name || '—'}</td>
                          <td className="px-5 py-3 text-muted-foreground">{(s as any).subscription_plans?.name || '—'}</td>
                          <td className="px-5 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums">{fmt(Number(s.monthly_price))}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground hidden md:table-cell">
                            {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('pt-BR') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        )}

        {tab === 'overdue' && (
          <ScrollReveal>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold text-base mb-4">Restaurantes inadimplentes</h3>
              {(data?.overdueRestaurants || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum restaurante inadimplente 🎉</p>
              ) : (
                <div className="space-y-3">
                  {(data?.overdueRestaurants || []).map((o: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-destructive/5 border border-destructive/20 p-4">
                      <div>
                        <p className="font-medium text-sm">{o.restaurants?.name || 'Restaurante'}</p>
                        <p className="text-xs text-muted-foreground">Valor em aberto: {fmt(Number(o.monthly_price))}</p>
                      </div>
                      <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Inadimplente</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>
        )}
      </div>
    </MasterLayout>
  );
}
