import { useMemo } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Zap, TrendingUp, Trophy, Beer, Activity } from 'lucide-react';
import { useQuickSaleStats, useStaffNames } from '@/hooks/useQuickSale';
import { useRestaurantSettings } from '@/hooks/useRestaurantData';
import { Link } from 'react-router-dom';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function BaladaLivePage() {
  const { data: stats, isLoading } = useQuickSaleStats();
  const { data: settings } = useRestaurantSettings();
  const enabled = (settings as any)?.quick_sale_enabled === true;
  const commissionPct = Number((settings as any)?.quick_sale_commission_percent || 0);

  const userIds = useMemo(
    () => Object.keys(stats?.perServer || {}).filter((k) => k !== 'unknown'),
    [stats]
  );
  const { data: names = {} } = useStaffNames(userIds);

  const ranking = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.perServer)
      .map(([userId, v]) => ({
        userId,
        name: userId === 'unknown' ? 'Sem identificação' : names[userId] || 'Garçom',
        count: v.count,
        total: v.total,
        commission: (v.total * commissionPct) / 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [stats, names, commissionPct]);

  const peakBucket = useMemo(() => {
    if (!stats) return 0;
    return Math.max(1, ...stats.salesPerMinute);
  }, [stats]);

  if (!enabled) {
    return (
      <RestaurantLayout>
        <ScrollReveal>
          <div className="card-elevated p-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-heading font-bold text-xl mb-1">Modo Balada desativado</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ative o Modo Balada nas <Link to="/restaurant/settings" className="text-primary underline">configurações</Link> do restaurante para começar a vender em pé com o garçom usando o app.
            </p>
          </div>
        </ScrollReveal>
      </RestaurantLayout>
    );
  }

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground flex items-center gap-1">
          <Link to="/restaurant" className="hover:text-foreground hover:underline transition-colors">Painel</Link>
          <span>›</span>
          <span className="text-foreground font-medium">Modo Balada</span>
        </nav>
        <ScrollReveal>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                <h1 className="font-heading text-2xl font-bold">Modo Balada — ao vivo</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" /> Live
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Ranking em tempo real, top produtos e fechamento por garçom.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/restaurant"
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                ← Painel
              </Link>
              <Link
                to="/garcom/balada"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Abrir app de venda
              </Link>
            </div>
          </div>
        </ScrollReveal>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScrollReveal>
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Vendas hoje</p>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="font-heading text-3xl font-bold mt-2">
                {isLoading ? '...' : stats?.totalSales ?? 0}
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <p className="font-heading text-3xl font-bold mt-2">
                {isLoading ? '...' : fmt(stats?.totalRevenue ?? 0)}
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Ticket médio</p>
                <Beer className="h-4 w-4 text-primary" />
              </div>
              <p className="font-heading text-3xl font-bold mt-2">
                {isLoading || !stats?.totalSales
                  ? fmt(0)
                  : fmt((stats?.totalRevenue ?? 0) / stats.totalSales)}
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* Live pulse */}
        <ScrollReveal>
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-heading font-semibold">Pulso (últimos 30 min)</h3>
            </div>
            <div className="flex items-end gap-1 h-24">
              {(stats?.salesPerMinute || new Array(30).fill(0)).map((v: number, i: number) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/70 hover:bg-primary transition-colors"
                  style={{ height: `${Math.max(4, (v / peakBucket) * 100)}%` }}
                  title={`${v} venda(s) há ${29 - i} min`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats && stats.salesPerMinute.reduce((a, b) => a + b, 0)} vendas nos últimos 30 minutos
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ranking */}
          <ScrollReveal>
            <div className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="font-heading font-semibold">Ranking de garçons</h3>
                {commissionPct > 0 && (
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    Comissão: {commissionPct}%
                  </span>
                )}
              </div>
              {ranking.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma venda hoje.
                </p>
              ) : (
                <div className="space-y-2">
                  {ranking.map((r, idx) => (
                    <div key={r.userId} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-white' :
                        idx === 1 ? 'bg-slate-400 text-white' :
                        idx === 2 ? 'bg-orange-700 text-white' :
                        'bg-muted-foreground/20 text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.count} venda{r.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(r.total)}</p>
                        {commissionPct > 0 && (
                          <p className="text-[11px] text-success">+ {fmt(r.commission)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>

          {/* Top products */}
          <ScrollReveal>
            <div className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-3">
                <Beer className="h-4 w-4 text-primary" />
                <h3 className="font-heading font-semibold">Top produtos hoje</h3>
              </div>
              {!stats || stats.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum produto vendido ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.topProducts.map((p, idx) => (
                    <div key={p.name + idx} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{idx + 1}</span>
                      <p className="flex-1 text-sm font-medium truncate">{p.name}</p>
                      <span className="text-sm font-bold text-primary">{p.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </RestaurantLayout>
  );
}
