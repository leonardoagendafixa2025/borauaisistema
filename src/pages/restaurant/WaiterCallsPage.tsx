import { Bell, Receipt, Check, Clock, Volume2 } from 'lucide-react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useState } from 'react';
import { useRestaurantWaiterCalls } from '@/hooks/useRestaurantData';
import { useRealtimeWaiterCalls } from '@/hooks/useRealtimeOrders';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

const typeConfig: Record<string, { label: string; icon: typeof Bell; class: string }> = {
  call_waiter: { label: 'Chamar Garçom', icon: Bell, class: 'bg-primary/10 text-primary' },
  request_bill: { label: 'Pedir Conta', icon: Receipt, class: 'bg-warning/10 text-warning' },
};

const statusConfigMap: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendente', class: 'bg-destructive/10 text-destructive animate-pulse' },
  acknowledged: { label: 'Em atendimento', class: 'bg-primary/10 text-primary' },
  completed: { label: 'Concluído', class: 'bg-success/10 text-success' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

export default function WaiterCallsPage() {
  useRealtimeWaiterCalls();
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: calls = [], isLoading } = useRestaurantWaiterCalls();
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');

  const filtered = filter === 'pending' ? calls.filter(c => c.status === 'pending') : calls;
  const pendingCount = calls.filter(c => c.status === 'pending').length;

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('waiter_calls').update({ 
      status, 
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {})
    }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['waiter_calls', restaurantId] });
  };

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
                Chamadas
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-1.5 animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">Chamadas de garçom e pedidos de conta em tempo real</p>
            </div>
            <button className="p-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors" title="Som">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="flex gap-2">
            {(['pending', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}>
                {f === 'pending' ? `Pendentes (${pendingCount})` : 'Todas'}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal>
          {isLoading ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-3">
              {filtered.length === 0 && (
                <div className="card-elevated p-8 text-center">
                  <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma chamada pendente</p>
                </div>
              )}
              {filtered.map(call => {
                const tp = typeConfig[call.type] || typeConfig.call_waiter;
                const st = statusConfigMap[call.status] || statusConfigMap.pending;
                const Icon = tp.icon;
                const table = call.restaurant_tables as any;
                return (
                  <div key={call.id} className={`card-elevated p-4 flex items-center gap-4 ${call.status === 'pending' ? 'ring-2 ring-destructive/20' : ''}`}>
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${tp.class}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold">{table?.label || `Mesa ${table?.number}`}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.class}`}>{st.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{tp.label}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(call.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {call.status === 'pending' && (
                        <button onClick={() => updateStatus(call.id, 'acknowledged')}
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                          Atender
                        </button>
                      )}
                      {call.status === 'acknowledged' && (
                        <button onClick={() => updateStatus(call.id, 'completed')}
                          className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-3 py-2 text-xs font-medium text-success hover:bg-success/20 transition-colors">
                          <Check className="h-3 w-3" /> Concluir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollReveal>
      </div>
    </RestaurantLayout>
  );
}
