import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Search, Download, Filter, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_LABELS: Record<string, { label: string; class: string }> = {
  restaurant_created: { label: 'Restaurante criado', class: 'bg-success/10 text-success' },
  restaurant_status_changed: { label: 'Status do restaurante', class: 'bg-warning/10 text-warning' },
  subscription_changed: { label: 'Assinatura alterada', class: 'bg-primary/10 text-primary' },
  platform_setting_changed: { label: 'Configuração alterada', class: 'bg-muted text-muted-foreground' },
  impersonate_started: { label: 'Impersonate iniciado', class: 'bg-destructive/10 text-destructive' },
  broadcast_sent: { label: 'Comunicado enviado', class: 'bg-blue-500/10 text-blue-500' },
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [days, setDays] = useState('7');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', days],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchesAction = actionFilter === 'all' || l.action === actionFilter;
      const haystack = `${l.action} ${l.entity_type ?? ''} ${JSON.stringify(l.metadata ?? {})}`.toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.toLowerCase());
      return matchesAction && matchesSearch;
    });
  }, [logs, search, actionFilter]);

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action))), [logs]);

  const exportCSV = () => {
    const headers = ['Data', 'Ação', 'Entidade', 'ID', 'Usuário', 'Detalhes'];
    const rows = filtered.map(l => [
      format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
      l.action,
      l.entity_type ?? '',
      l.entity_id ?? '',
      l.user_id ?? '',
      JSON.stringify(l.metadata ?? {}).replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6" /> Auditoria
              </h1>
              <p className="text-sm text-muted-foreground">Histórico completo de ações na plataforma</p>
            </div>
            <Button onClick={exportCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="card-elevated p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar em ações, entidades, metadados..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {uniqueActions.map(a => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Ação</th>
                    <th className="px-4 py-3 text-left">Entidade</th>
                    <th className="px-4 py-3 text-left">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">Nenhum log encontrado</td></tr>
                  ) : (
                    filtered.map(l => {
                      const cfg = ACTION_LABELS[l.action] ?? { label: l.action, class: 'bg-muted text-muted-foreground' };
                      return (
                        <tr key={l.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                            {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cfg.class}>{cfg.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div>{l.entity_type ?? '—'}</div>
                            {l.entity_id && <div className="text-muted-foreground font-mono">{l.entity_id.slice(0, 8)}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-md">
                            {l.metadata && Object.keys(l.metadata as any).length > 0 ? (
                              <details>
                                <summary className="cursor-pointer text-primary hover:underline">Ver detalhes</summary>
                                <pre className="mt-2 text-[10px] bg-muted/50 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(l.metadata, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>

        <p className="text-xs text-muted-foreground text-center">
          Mostrando {filtered.length} de {logs.length} registros
        </p>
      </div>
    </MasterLayout>
  );
}
