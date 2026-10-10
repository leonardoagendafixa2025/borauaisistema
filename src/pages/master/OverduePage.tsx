import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { AlertTriangle, MessageCircle, Send, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OverduePage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: overdueRestaurants = [], isLoading } = useQuery({
    queryKey: ['overdue-restaurants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurants')
        .select(`
          id, name, status, whatsapp, phone, owner_id, suspension_reason, suspended_at,
          subscriptions(id, status, current_period_end, monthly_price, plan_id, subscription_plans(name))
        `)
        .in('status', ['overdue', 'suspended'])
        .order('updated_at', { ascending: false });
      return data || [];
    },
  });

  const enriched = useMemo(() => {
    return overdueRestaurants.map((r: any) => {
      const sub = (r.subscriptions || [])[0];
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      const daysOverdue = periodEnd ? differenceInDays(new Date(), periodEnd) : 0;
      return { ...r, sub, daysOverdue };
    });
  }, [overdueRestaurants]);

  const totalOverdueValue = useMemo(
    () => enriched.reduce((sum: number, r: any) => sum + Number(r.sub?.monthly_price ?? 0), 0),
    [enriched]
  );

  const sendCharge = async (r: any, channel: 'whatsapp' | 'telegram') => {
    setBusyId(r.id);
    try {
      const message =
        `⚠️ *${r.name}*, sua assinatura Bora Uai está com pagamento em atraso há ${r.daysOverdue} dia(s).\n\n` +
        `Valor: R$ ${Number(r.sub?.monthly_price ?? 0).toFixed(2)}\n` +
        `Plano: ${r.sub?.subscription_plans?.name ?? '—'}\n\n` +
        `Regularize o quanto antes para evitar a suspensão.`;

      if (channel === 'whatsapp') {
        if (!r.whatsapp) { toast.error('Restaurante sem WhatsApp cadastrado'); return; }
        const phone = String(r.whatsapp).replace(/\D/g, '');
        const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
        toast.success('WhatsApp aberto');
      } else {
        const { data, error } = await supabase.functions.invoke('master-broadcast', {
          body: {
            channel: 'telegram',
            template_key: 'payment_overdue',
            body: message,
            segment: { restaurant_ids: [r.id] },
          },
        });
        if (error) throw error;
        if (data?.sent > 0) toast.success('Cobrança enviada via Telegram');
        else toast.warning('Restaurante sem chat Telegram vinculado');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" /> Inadimplência
              </h1>
              <p className="text-sm text-muted-foreground">Restaurantes em atraso ou suspensos</p>
            </div>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['overdue-restaurants'] })}>
              <RefreshCw className="h-4 w-4 mr-2" />Atualizar
            </Button>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScrollReveal>
            <div className="card-elevated p-4">
              <div className="text-xs uppercase text-muted-foreground">Inadimplentes</div>
              <div className="text-3xl font-bold mt-1">
                {enriched.filter((r: any) => r.status === 'overdue').length}
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-4">
              <div className="text-xs uppercase text-muted-foreground">Suspensos</div>
              <div className="text-3xl font-bold mt-1">
                {enriched.filter((r: any) => r.status === 'suspended').length}
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-4">
              <div className="text-xs uppercase text-muted-foreground">Valor em risco</div>
              <div className="text-3xl font-bold mt-1">R$ {totalOverdueValue.toFixed(2)}</div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal>
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Restaurante</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Plano</th>
                    <th className="px-4 py-3 text-left">Valor</th>
                    <th className="px-4 py-3 text-left">Dias atraso</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                  ) : enriched.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">🎉 Nenhuma inadimplência ativa!</td></tr>
                  ) : enriched.map((r: any) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.name}</div>
                        {r.suspension_reason && <div className="text-[10px] text-destructive">{r.suspension_reason}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={
                          r.status === 'overdue' ? 'bg-destructive/10 text-destructive border-destructive/30'
                          : 'bg-warning/10 text-warning border-warning/30'
                        }>
                          {r.status === 'overdue' ? 'Inadimplente' : 'Suspenso'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{r.sub?.subscription_plans?.name ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-sm">R$ {Number(r.sub?.monthly_price ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={r.daysOverdue > 7 ? 'text-destructive' : ''}>
                          {r.daysOverdue} dias
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => sendCharge(r, 'whatsapp')} disabled={busyId === r.id || !r.whatsapp}>
                            <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => sendCharge(r, 'telegram')} disabled={busyId === r.id}>
                            <Send className="h-3.5 w-3.5 mr-1" /> Telegram
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </MasterLayout>
  );
}
