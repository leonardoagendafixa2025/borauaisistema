import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Sparkles, Check, X, AlertCircle, ExternalLink, Loader2, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type CheckResult = { ok: boolean; label: string; hint?: string };

export default function OnboardingHealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-health'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const { data: rests } = await supabase
        .from('restaurants')
        .select('id, name, slug, status, created_at, owner_id, logo_url')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });

      const list = rests || [];
      if (list.length === 0) return { restaurants: [], stats: { total: 0, healthy: 0, atRisk: 0, conversionPct: 0 } };

      const ids = list.map(r => r.id);

      const [
        { data: products },
        { data: orders },
        { data: settings },
        { data: tables },
        { data: subs },
      ] = await Promise.all([
        supabase.from('products').select('restaurant_id').in('restaurant_id', ids),
        supabase.from('orders').select('restaurant_id, created_at, status').in('restaurant_id', ids),
        supabase.from('restaurant_settings').select('restaurant_id, telegram_chat_id, opening_hours, primary_color').in('restaurant_id', ids),
        supabase.from('restaurant_tables').select('restaurant_id').in('restaurant_id', ids),
        supabase.from('subscriptions').select('restaurant_id, status, plan_id').in('restaurant_id', ids),
      ]);

      const productCount = new Map<string, number>();
      (products || []).forEach(p => productCount.set(p.restaurant_id, (productCount.get(p.restaurant_id) || 0) + 1));

      const orderCount = new Map<string, number>();
      const completedCount = new Map<string, number>();
      (orders || []).forEach(o => {
        orderCount.set(o.restaurant_id, (orderCount.get(o.restaurant_id) || 0) + 1);
        if (o.status === 'completed') completedCount.set(o.restaurant_id, (completedCount.get(o.restaurant_id) || 0) + 1);
      });

      const settingsMap = new Map((settings || []).map(s => [s.restaurant_id, s]));
      const tableCount = new Map<string, number>();
      (tables || []).forEach(t => tableCount.set(t.restaurant_id, (tableCount.get(t.restaurant_id) || 0) + 1));
      const subMap = new Map((subs || []).map(s => [s.restaurant_id, s]));

      const enriched = list.map(r => {
        const settings = settingsMap.get(r.id);
        const checks: CheckResult[] = [
          { ok: !!r.owner_id, label: 'Proprietário vinculado', hint: 'Crie/vincule um owner' },
          { ok: !!r.logo_url, label: 'Logo enviada' },
          { ok: (productCount.get(r.id) || 0) >= 5, label: `Cardápio com 5+ itens (${productCount.get(r.id) || 0})` },
          { ok: (orderCount.get(r.id) || 0) >= 1, label: `Primeiro pedido recebido (${orderCount.get(r.id) || 0})` },
          { ok: (completedCount.get(r.id) || 0) >= 1, label: 'Primeiro pedido concluído' },
          { ok: !!(settings?.telegram_chat_id), label: 'Telegram conectado' },
          { ok: !!subMap.get(r.id), label: 'Plano de assinatura ativo' },
        ];
        const passed = checks.filter(c => c.ok).length;
        const score = Math.round((passed / checks.length) * 100);
        const ageHours = (Date.now() - new Date(r.created_at).getTime()) / 3600000;
        const status = score >= 70 ? 'healthy' : score >= 40 ? 'progress' : ageHours > 48 ? 'at_risk' : 'new';
        return { ...r, checks, score, status, ageHours };
      });

      const stats = {
        total: enriched.length,
        healthy: enriched.filter(r => r.status === 'healthy').length,
        atRisk: enriched.filter(r => r.status === 'at_risk').length,
        conversionPct: Math.round(
          (enriched.filter(r => r.status === 'healthy').length / Math.max(enriched.length, 1)) * 100
        ),
      };

      return { restaurants: enriched, stats };
    },
  });

  const statusBadge = (s: string) => {
    if (s === 'healthy') return { label: 'Saudável', class: 'bg-success/10 text-success border-success/20' };
    if (s === 'progress') return { label: 'Progredindo', class: 'bg-primary/10 text-primary border-primary/20' };
    if (s === 'at_risk') return { label: 'Em risco', class: 'bg-destructive/10 text-destructive border-destructive/20' };
    return { label: 'Recém-criado', class: 'bg-muted text-muted-foreground border-border' };
  };

  return (
    <MasterLayout>
      <ScrollReveal>
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Onboarding — Primeiros 7 dias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Saúde dos restaurantes recém-criados. Identifique quem precisa de ajuda antes que cancele.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Novos (7d)', value: data?.stats.total ?? 0, icon: Sparkles },
            { label: 'Saudáveis', value: data?.stats.healthy ?? 0, icon: Check, color: 'text-success' },
            { label: 'Em risco', value: data?.stats.atRisk ?? 0, icon: AlertCircle, color: 'text-destructive' },
            { label: 'Taxa de ativação', value: `${data?.stats.conversionPct ?? 0}%`, icon: TrendingUp, color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-muted-foreground tracking-wide">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color || 'text-muted-foreground'}`} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${s.color || ''}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}

        {!isLoading && (data?.restaurants.length ?? 0) === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            Nenhum restaurante criado nos últimos 7 dias.
          </div>
        )}

        <div className="grid gap-4">
          {data?.restaurants.map((r: any) => {
            const badge = statusBadge(r.status);
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    {r.logo_url ? (
                      <img src={r.logo_url} alt={r.name} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold">
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{r.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Criado {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })} • /{r.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold">{r.score}%</p>
                      <p className={`text-xs px-2 py-0.5 rounded-full border inline-block ${badge.class}`}>{badge.label}</p>
                    </div>
                    <Link
                      to={`/master/restaurants`}
                      className="text-primary hover:bg-primary/10 p-2 rounded-lg"
                      title="Abrir lista"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {r.checks.map((c: CheckResult, i: number) => (
                    <div key={i} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${c.ok ? 'bg-success/5 text-success' : 'bg-muted/40 text-muted-foreground'}`}>
                      {c.ok ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
                      <span className={c.ok ? 'text-foreground' : ''}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </MasterLayout>
  );
}
