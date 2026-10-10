import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Activity } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SEO } from '@/components/seo/SEO';
import logoImg from '@/assets/logo.png';

const COMPONENTS = [
  { key: 'api', name: 'API e Banco de Dados' },
  { key: 'dashboard', name: 'Painel Admin' },
  { key: 'menu', name: 'Cardápio Público / QR Code' },
  { key: 'kds', name: 'KDS (Cozinha)' },
  { key: 'telegram', name: 'Bot Telegram' },
  { key: 'billing', name: 'Cobrança (Stripe)' },
];

const SEVERITY_META: Record<string, { color: string; label: string; icon: any }> = {
  minor: { color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30', label: 'Menor', icon: AlertTriangle },
  major: { color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30', label: 'Maior', icon: AlertTriangle },
  critical: { color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30', label: 'Crítico', icon: XCircle },
};

const STATUS_LABEL: Record<string, string> = {
  investigating: 'Investigando',
  identified: 'Identificado',
  monitoring: 'Monitorando',
  resolved: 'Resolvido',
};

export default function StatusPage() {
  useEffect(() => {
    document.title = 'Status do Sistema — Bora Uai';
  }, []);

  const { data: incidents = [] } = useQuery({
    queryKey: ['public-incidents'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await (publicSupabase
        .from('status_incidents' as any)
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20) as any);
      return (data as any[]) || [];
    },
  });

  const activeIncidents = incidents.filter((i: any) => i.status !== 'resolved');
  const allOk = activeIncidents.length === 0;

  const componentStatus = (key: string) => {
    const incident = activeIncidents.find((i: any) => i.component === key);
    if (!incident) return 'operational';
    return incident.severity;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <SEO
        title="Status do Sistema — Bora Uai"
        description="Status em tempo real da plataforma Bora Uai: API, painel, cardápio público, KDS, Telegram e cobrança."
        path="/status"
      />
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Bora Uai" className="h-8 w-8 rounded-lg" />
            <span className="font-heading font-bold text-lg">Bora Uai</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        </div>
      </header>

      <section className="px-4 py-10 max-w-4xl mx-auto">
        {/* Status hero */}
        <div className={`rounded-2xl p-8 text-center mb-8 ${
          allOk
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
            : 'bg-gradient-to-br from-orange-500 to-red-600 text-white'
        }`}>
          {allOk ? (
            <>
              <CheckCircle2 className="w-16 h-16 mx-auto mb-3" />
              <h1 className="font-heading text-3xl md:text-4xl font-extrabold mb-2">Tudo funcionando</h1>
              <p className="text-white/90">Todos os sistemas operando normalmente.</p>
            </>
          ) : (
            <>
              <AlertTriangle className="w-16 h-16 mx-auto mb-3" />
              <h1 className="font-heading text-3xl md:text-4xl font-extrabold mb-2">
                {activeIncidents.length} incidente{activeIncidents.length > 1 ? 's' : ''} ativo{activeIncidents.length > 1 ? 's' : ''}
              </h1>
              <p className="text-white/90">Estamos trabalhando para resolver.</p>
            </>
          )}
        </div>

        {/* Components */}
        <div className="rounded-2xl border bg-card overflow-hidden mb-8">
          <div className="p-5 border-b">
            <h2 className="font-heading text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5" /> Componentes
            </h2>
          </div>
          <div className="divide-y">
            {COMPONENTS.map(c => {
              const status = componentStatus(c.key);
              const ok = status === 'operational';
              return (
                <div key={c.key} className="p-4 flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  {ok ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> Operacional
                    </span>
                  ) : (
                    <Badge className={SEVERITY_META[status]?.color || ''}>
                      {SEVERITY_META[status]?.label || 'Problema'}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Incidents */}
        <div>
          <h2 className="font-heading text-xl font-bold mb-4">Histórico recente</h2>
          {incidents.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              Nenhum incidente registrado nos últimos dias. 🎉
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc: any) => {
                const meta = SEVERITY_META[inc.severity] || SEVERITY_META.minor;
                const Icon = meta.icon;
                return (
                  <div key={inc.id} className="rounded-xl border bg-card p-5">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-1 shrink-0 ${meta.color.split(' ')[1]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold">{inc.title}</h3>
                          <Badge variant="outline">{STATUS_LABEL[inc.status] || inc.status}</Badge>
                          <Badge className={meta.color}>{meta.label}</Badge>
                        </div>
                        {inc.description && (
                          <p className="text-sm text-muted-foreground mb-2">{inc.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Iniciado {formatDistanceToNow(new Date(inc.started_at), { addSuffix: true, locale: ptBR })}
                          {inc.resolved_at && ` · Resolvido ${formatDistanceToNow(new Date(inc.resolved_at), { addSuffix: true, locale: ptBR })}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Atualiza automaticamente a cada minuto.
        </p>
      </section>
    </div>
  );
}
