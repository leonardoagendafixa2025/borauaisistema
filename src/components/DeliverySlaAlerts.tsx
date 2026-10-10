import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantSettings } from '@/hooks/useRestaurantData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const SLA_BUFFER: Record<string, number> = { preparing: 0, ready: 10, delivering: 30 };
const STATUS_LABEL: Record<string, string> = {
  preparing: 'Em preparo',
  ready: 'Pronto aguardando',
  delivering: 'Saiu para entrega',
};

interface SlaOrder {
  id: string;
  number: number;
  status: string;
  customer_name: string;
  address: string | null;
  created_at: string;
  sla_alert_sent_at: string | null;
  sla_acknowledged_at: string | null;
}

export default function DeliverySlaAlerts() {
  const { restaurantId } = useAuth();
  const { data: settings } = useRestaurantSettings();
  const queryClient = useQueryClient();
  const prepTime = settings?.estimated_prep_time || 30;

  const { data: orders = [] } = useQuery({
    queryKey: ['sla-orders', restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, number, status, customer_name, address, created_at, sla_alert_sent_at, sla_acknowledged_at')
        .eq('restaurant_id', restaurantId!)
        .eq('type', 'delivery')
        .is('sla_acknowledged_at', null)
        .in('status', ['preparing', 'ready', 'delivering'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as SlaOrder[];
    },
  });

  const now = Date.now();
  const late = orders.filter((o) => {
    const buffer = SLA_BUFFER[o.status] ?? 0;
    const limitMs = (prepTime + buffer) * 60_000;
    return now - new Date(o.created_at).getTime() > limitMs;
  });

  if (late.length === 0) return null;

  const handleAcknowledge = async (orderId: string) => {
    const { error } = await (supabase
      .from('orders')
      .update({ sla_acknowledged_at: new Date().toISOString() } as any)
      .eq('id', orderId));
    if (error) {
      toast.error('Erro ao marcar como tratado');
      return;
    }
    toast.success('Alerta tratado');
    queryClient.invalidateQueries({ queryKey: ['sla-orders', restaurantId] });
  };

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-destructive font-semibold">
        <AlertTriangle className="h-5 w-5" />
        <span>{late.length} pedido(s) de delivery em atraso</span>
      </div>
      <div className="space-y-2">
        {late.map((o) => {
          const buffer = SLA_BUFFER[o.status] ?? 0;
          const limitMs = (prepTime + buffer) * 60_000;
          const ageMs = now - new Date(o.created_at).getTime();
          const minutesLate = Math.floor((ageMs - limitMs) / 60_000);
          return (
            <div
              key={o.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-background border border-border p-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">#{o.number}</span>
                  <Badge variant="outline">{STATUS_LABEL[o.status]}</Badge>
                  <Badge variant="destructive" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {minutesLate}min atrasado
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {o.customer_name}
                  {o.address ? ` · ${o.address}` : ''}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAcknowledge(o.id)}
                className="shrink-0"
              >
                <Check className="h-4 w-4 mr-1" />
                Tratado
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
