import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { LogIn, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ImpersonationLogPage() {
  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['impersonation-tokens'],
    queryFn: async () => {
      const { data } = await supabase
        .from('impersonation_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      const list = data || [];

      const adminIds = [...new Set(list.map(t => t.admin_user_id).filter(Boolean))];
      const targetIds = [...new Set(list.map(t => t.target_user_id).filter(Boolean))];
      const restaurantIds = [...new Set(list.map(t => t.restaurant_id).filter(Boolean) as string[])];

      const [{ data: profiles }, { data: rests }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', [...adminIds, ...targetIds]),
        restaurantIds.length
          ? supabase.from('restaurants').select('id, name, slug').in('id', restaurantIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      const restMap = new Map((rests || []).map(r => [r.id, r]));

      return list.map(t => ({
        ...t,
        admin_name: profileMap.get(t.admin_user_id) || 'Admin',
        target_name: profileMap.get(t.target_user_id) || 'Proprietário',
        restaurant: t.restaurant_id ? restMap.get(t.restaurant_id) : null,
      }));
    },
  });

  const stats = {
    total: tokens.length,
    used: tokens.filter(t => t.used_at).length,
    expired: tokens.filter(t => !t.used_at && new Date(t.expires_at) < new Date()).length,
    active: tokens.filter(t => !t.used_at && new Date(t.expires_at) >= new Date()).length,
  };

  const getStatus = (t: any) => {
    if (t.used_at) return { label: 'Usado', color: 'bg-success/10 text-success border-success/20' };
    if (new Date(t.expires_at) < new Date()) return { label: 'Expirado', color: 'bg-muted text-muted-foreground border-border' };
    return { label: 'Ativo', color: 'bg-primary/10 text-primary border-primary/20' };
  };

  return (
    <MasterLayout>
      <ScrollReveal>
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LogIn className="h-6 w-6 text-primary" /> Log de Impersonations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria de acessos administrativos a contas de proprietários (suporte).
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: ShieldCheck, color: 'text-foreground' },
            { label: 'Ativos', value: stats.active, icon: Clock, color: 'text-primary' },
            { label: 'Usados', value: stats.used, icon: LogIn, color: 'text-success' },
            { label: 'Expirados', value: stats.expired, icon: AlertCircle, color: 'text-muted-foreground' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-muted-foreground tracking-wide">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Quando</th>
                  <th className="px-4 py-3 text-left font-medium">Admin</th>
                  <th className="px-4 py-3 text-left font-medium">Restaurante</th>
                  <th className="px-4 py-3 text-left font-medium">Motivo</th>
                  <th className="px-4 py-3 text-left font-medium">Expira</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
                )}
                {!isLoading && tokens.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum acesso registrado.</td></tr>
                )}
                {tokens.map((t: any) => {
                  const status = getStatus(t);
                  return (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{format(new Date(t.created_at), "dd/MM HH:mm", { locale: ptBR })}</div>
                        <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}</div>
                      </td>
                      <td className="px-4 py-3">{t.admin_name}</td>
                      <td className="px-4 py-3">
                        {t.restaurant ? (
                          <div>
                            <div className="font-medium">{t.restaurant.name}</div>
                            <div className="text-xs text-muted-foreground">/{t.restaurant.slug}</div>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{t.reason || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(t.expires_at), "dd/MM HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={status.color} variant="outline">{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ScrollReveal>
    </MasterLayout>
  );
}
