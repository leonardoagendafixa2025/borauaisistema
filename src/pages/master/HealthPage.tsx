import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Activity, Server, Zap, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CRON_JOBS = [
  { name: 'telegram-poll-updates', schedule: 'A cada 1 minuto', purpose: 'Processa mensagens recebidas pelo bot' },
  { name: 'expire-trials', schedule: 'Diariamente', purpose: 'Suspende contas com trial expirado' },
  { name: 'payments-webhook', schedule: 'Sob demanda', purpose: 'Recebe eventos do Stripe (assinaturas e pagamentos)' },
  { name: 'delivery-sla-check', schedule: 'A cada 5 minutos', purpose: 'Detecta atrasos em entregas' },
  { name: 'check-restaurant-hours', schedule: 'A cada 5 minutos', purpose: 'Abre/fecha restaurantes por horário' },
  { name: 'telegram-daily-summary', schedule: 'Diariamente às 22h', purpose: 'Resumo do dia para os donos' },
];

const EDGE_FUNCTIONS = [
  'telegram-notify',
  'telegram-auto-link',
  'create-checkout',
  'payments-webhook',
  'create-portal-session',
  'master-broadcast',
  'master-impersonate',
  'admin-update-user',
  'ai-insights',
];

export default function HealthPage() {
  const { data: recentAudits, isLoading: aLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['health-recent-audits'],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: lastBroadcasts } = useQuery({
    queryKey: ['health-broadcasts'],
    queryFn: async () => {
      const { data } = await (supabase.from('master_broadcasts' as any).select('*').order('created_at', { ascending: false }).limit(5) as any);
      return data || [];
    },
  });

  const { data: lastNotifications } = useQuery({
    queryKey: ['health-notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['health-stats'],
    queryFn: async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const [orders, audits] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
      ]);
      return {
        orders24h: orders.count ?? 0,
        audits24h: audits.count ?? 0,
      };
    },
  });

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6" /> Saúde do Sistema
              </h1>
              <p className="text-sm text-muted-foreground">Status de cron jobs, edge functions e atividade recente</p>
            </div>
            <Button variant="outline" onClick={() => refetchAudit()}>
              <RefreshCw className="h-4 w-4 mr-2" />Atualizar
            </Button>
          </div>
        </ScrollReveal>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScrollReveal>
            <div className="card-elevated p-4">
              <div className="text-xs text-muted-foreground uppercase">Pedidos 24h</div>
              <div className="text-2xl font-bold mt-1">{stats?.orders24h ?? '—'}</div>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-4">
              <div className="text-xs text-muted-foreground uppercase">Eventos auditoria 24h</div>
              <div className="text-2xl font-bold mt-1">{stats?.audits24h ?? '—'}</div>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-4">
              <div className="text-xs text-muted-foreground uppercase">Cron jobs</div>
              <div className="text-2xl font-bold mt-1">{CRON_JOBS.length}</div>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-4">
              <div className="text-xs text-muted-foreground uppercase">Edge functions</div>
              <div className="text-2xl font-bold mt-1">{EDGE_FUNCTIONS.length}</div>
            </div>
          </ScrollReveal>
        </div>

        {/* Cron Jobs */}
        <ScrollReveal>
          <div className="card-elevated p-5">
            <h2 className="font-heading font-semibold flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-primary" /> Cron Jobs
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2">Job</th>
                    <th className="text-left py-2">Frequência</th>
                    <th className="text-left py-2">Função</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CRON_JOBS.map(j => (
                    <tr key={j.name}>
                      <td className="py-3 font-mono text-xs">{j.name}</td>
                      <td className="py-3 text-xs text-muted-foreground">{j.schedule}</td>
                      <td className="py-3 text-xs text-muted-foreground">{j.purpose}</td>
                      <td className="py-3">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Agendado
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Para ver logs detalhados de cada execução, acesse o painel do Lovable Cloud → Functions.
            </p>
          </div>
        </ScrollReveal>

        {/* Edge Functions */}
        <ScrollReveal>
          <div className="card-elevated p-5">
            <h2 className="font-heading font-semibold flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" /> Edge Functions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {EDGE_FUNCTIONS.map(fn => (
                <div key={fn} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-xs font-mono">
                  <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                  <span className="truncate">{fn}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Atividade Recente */}
        <div className="grid md:grid-cols-2 gap-4">
          <ScrollReveal>
            <div className="card-elevated p-5">
              <h2 className="font-heading font-semibold flex items-center gap-2 mb-4">
                <Server className="h-5 w-5 text-primary" /> Auditoria recente
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {aLoading ? <p className="text-sm text-muted-foreground">Carregando...</p>
                : recentAudits?.length === 0 ? <p className="text-sm text-muted-foreground">Sem atividade recente</p>
                : recentAudits?.map((a: any) => (
                  <div key={a.id} className="text-xs border-l-2 border-primary/30 pl-3 py-1">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-muted-foreground">
                      {a.entity_type} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="card-elevated p-5">
              <h2 className="font-heading font-semibold flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-primary" /> Últimos comunicados
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {!lastBroadcasts || lastBroadcasts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum comunicado enviado ainda</p>
                ) : lastBroadcasts.map((b: any) => (
                  <div key={b.id} className="text-xs border-l-2 border-primary/30 pl-3 py-1">
                    <div className="font-medium">{b.subject ?? b.template_key ?? 'Sem assunto'}</div>
                    <div className="text-muted-foreground">
                      {b.sent_count}/{b.total_recipients} enviados · {formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </MasterLayout>
  );
}
