import { useMemo } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, ThumbsUp, ThumbsDown, Minus, MessageSquare, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MetricCard from '@/components/MetricCard';

export default function FeedbackPage() {
  const { restaurantId } = useAuth();

  const { data: surveys = [] } = useQuery({
    queryKey: ['surveys', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('satisfaction_surveys').select('*').eq('restaurant_id', restaurantId!).order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const { data: driverRatings = [] } = useQuery({
    queryKey: ['driver_ratings', restaurantId],
    queryFn: async () => {
      // Try with FK embed first; fall back to plain select if PostgREST embed fails for any reason.
      const withEmbed = await supabase
        .from('driver_ratings')
        .select('*, delivery_drivers(name)')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!withEmbed.error && withEmbed.data) return withEmbed.data;
      const fallback = await supabase
        .from('driver_ratings')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false })
        .limit(200);
      return fallback.data || [];
    },
    enabled: !!restaurantId,
  });

  const stats = useMemo(() => {
    const driverAvg = driverRatings.length
      ? driverRatings.reduce((s: number, x: any) => s + (Number(x.rating) || 0), 0) / driverRatings.length
      : 0;
    if (!surveys.length) return { nps: 0, avg: 0, total: 0, promoters: 0, passives: 0, detractors: 0, avgFood: 0, avgService: 0, avgDelivery: driverAvg };
    const promoters = surveys.filter(s => s.category === 'promoter').length;
    const passives = surveys.filter(s => s.category === 'passive').length;
    const detractors = surveys.filter(s => s.category === 'detractor').length;
    const total = surveys.length;
    const nps = Math.round(((promoters - detractors) / total) * 100);
    const avg = surveys.reduce((s, x) => s + x.score, 0) / total;
    const food = surveys.filter(s => s.food_rating);
    const service = surveys.filter(s => s.service_rating);
    return {
      nps, avg, total, promoters, passives, detractors,
      avgFood: food.length ? food.reduce((s, x) => s + x.food_rating, 0) / food.length : 0,
      avgService: service.length ? service.reduce((s, x) => s + x.service_rating, 0) / service.length : 0,
      avgDelivery: driverAvg,
    };
  }, [surveys, driverRatings]);

  const npsColor = stats.nps >= 50 ? 'text-success' : stats.nps >= 0 ? 'text-warning' : 'text-destructive';

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Avaliações & NPS</h1>
          <p className="text-sm text-muted-foreground">Pesquisas de satisfação dos clientes</p>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Índice de Satisfação (NPS)</p>
              <div className={`text-5xl font-heading font-bold ${npsColor}`}>{stats.nps}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.nps >= 50 ? 'Excelente' : stats.nps >= 0 ? 'Bom' : 'Crítico'} • {stats.total} avaliações
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <ThumbsUp className="h-6 w-6 mx-auto text-success mb-1" />
                <div className="text-2xl font-bold">{stats.promoters}</div>
                <div className="text-xs text-muted-foreground">Promotores</div>
              </div>
              <div className="text-center">
                <Minus className="h-6 w-6 mx-auto text-warning mb-1" />
                <div className="text-2xl font-bold">{stats.passives}</div>
                <div className="text-xs text-muted-foreground">Passivos</div>
              </div>
              <div className="text-center">
                <ThumbsDown className="h-6 w-6 mx-auto text-destructive mb-1" />
                <div className="text-2xl font-bold">{stats.detractors}</div>
                <div className="text-xs text-muted-foreground">Detratores</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <MetricCard label="Nota média" value={stats.avg.toFixed(1)} icon={Star} />
          <MetricCard label="Comida" value={stats.avgFood ? stats.avgFood.toFixed(1) + '/5' : '—'} icon={Star} />
          <MetricCard label="Atendimento" value={stats.avgService ? stats.avgService.toFixed(1) + '/5' : '—'} icon={Star} />
          <MetricCard label="Entrega" value={stats.avgDelivery ? stats.avgDelivery.toFixed(1) + '/5' : '—'} icon={Star} />
        </div>

        <Card className="p-4">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4" />Comentários recentes</h3>
          {surveys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Ainda não há avaliações</p>
              <p className="text-xs mt-1">Compartilhe o link <code className="bg-muted px-1.5 py-0.5 rounded">/avaliar/[restaurante-slug]</code> com seus clientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {surveys.slice(0, 30).map(s => {
                const cfg = s.category === 'promoter' ? { label: 'Promotor', cls: 'bg-success/10 text-success' }
                  : s.category === 'passive' ? { label: 'Passivo', cls: 'bg-warning/10 text-warning' }
                  : { label: 'Detrator', cls: 'bg-destructive/10 text-destructive' };
                return (
                  <div key={s.id} className="p-3 rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold">{s.score}</div>
                        <Badge variant="secondary" className={cfg.cls}>{cfg.label}</Badge>
                        {s.customer_name && <span className="text-sm text-muted-foreground">— {s.customer_name}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {s.comment && <p className="text-sm mt-2 text-foreground/80">"{s.comment}"</p>}
                    {Array.isArray((s as any).tags) && (s as any).tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(s as any).tags.map((t: string) => (
                          <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-muted">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      {s.food_rating && <span>🍽️ {s.food_rating}/5</span>}
                      {s.service_rating && <span>👨‍🍳 {s.service_rating}/5</span>}
                      {s.delivery_rating && <span>🛵 {s.delivery_rating}/5</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">🛵 Avaliações dos entregadores</h3>
          {driverRatings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma avaliação de entregador ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {driverRatings.slice(0, 30).map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                      {r.delivery_drivers?.name && (
                        <span className="text-sm font-medium">{r.delivery_drivers.name}</span>
                      )}
                      {r.customer_name && <span className="text-sm text-muted-foreground">— {r.customer_name}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {r.comment && <p className="text-sm mt-2 text-foreground/80">"{r.comment}"</p>}
                  {Array.isArray(r.tags) && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.tags.map((t: string) => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-muted">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </RestaurantLayout>
  );
}
