import { useState, useMemo, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, XCircle, Download } from 'lucide-react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useRestaurantOrders } from '@/hooks/useRestaurantData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function CashierPage() {
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useRestaurantOrders(undefined, 'today');

  // Fetch active cashier session from DB
  const { data: activeSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['cashier-session', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('cashier_sessions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('closed_at', null)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const cashierOpen = !!activeSession;
  const openedAt = activeSession?.opened_at ? new Date(activeSession.opened_at) : null;

  const todayOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return orders.filter(o => o.created_at.startsWith(today));
  }, [orders]);

  const completedOrders = todayOrders.filter(o => o.status === 'completed');
  const cancelledOrders = todayOrders.filter(o => o.status === 'cancelled');
  const pendingOrders = todayOrders.filter(o => !['completed', 'cancelled'].includes(o.status));

  const totalRevenue = completedOrders.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = completedOrders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const byPayment = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    completedOrders.forEach(o => {
      const method = o.payment_method || 'Não informado';
      if (!map[method]) map[method] = { count: 0, total: 0 };
      map[method].count++;
      map[method].total += Number(o.total);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [completedOrders]);

  const byType = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    completedOrders.forEach(o => {
      const type = o.type || 'outro';
      if (!map[type]) map[type] = { count: 0, total: 0 };
      map[type].count++;
      map[type].total += Number(o.total);
    });
    return Object.entries(map);
  }, [completedOrders]);

  const typeLabels: Record<string, string> = { delivery: 'Delivery', pickup: 'Retirada', dine_in: 'Mesa' };

  const handleOpenCashier = async () => {
    if (!restaurantId || !user) return;
    const { error } = await supabase.from('cashier_sessions').insert({
      restaurant_id: restaurantId,
      opened_by: user.id,
    });
    if (error) { toast.error('Erro ao abrir caixa'); return; }
    queryClient.invalidateQueries({ queryKey: ['cashier-session', restaurantId] });
    toast.success('Caixa aberto!');
  };

  const handleCloseCashier = async () => {
    if (!activeSession) return;
    if (!confirm(`Tem certeza que deseja fechar o caixa?\n\nResumo:\n• ${totalOrders} pedidos concluídos\n• Faturamento: ${fmt(totalRevenue)}\n• Ticket médio: ${fmt(avgTicket)}`)) return;
    const { error } = await supabase.from('cashier_sessions').update({
      closed_at: new Date().toISOString(),
      total_revenue: totalRevenue,
      total_orders: totalOrders,
    }).eq('id', activeSession.id);
    if (error) { toast.error('Erro ao fechar caixa'); return; }
    queryClient.invalidateQueries({ queryKey: ['cashier-session', restaurantId] });
    toast.success('Caixa fechado! Resumo salvo.');
  };

  const exportCSV = () => {
    const headers = 'Pedido,Tipo,Cliente,Total,Pagamento,Status,Hora\n';
    const rows = todayOrders.map(o =>
      `#${o.number},${typeLabels[o.type] || o.type},${o.customer_name},${Number(o.total).toFixed(2)},${o.payment_method || '-'},${o.status},${new Date(o.created_at).toLocaleTimeString('pt-BR')}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caixa-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const printReport = () => {
    const now = new Date();
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Fechamento de Caixa</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        h1 { font-size: 14px; margin-bottom: 4px; }
        h2 { font-size: 12px; margin: 8px 0 4px; }
      </style></head><body>
      <div class="center"><h1>RELATÓRIO DE CAIXA</h1><p>${now.toLocaleDateString('pt-BR')} — ${now.toLocaleTimeString('pt-BR')}</p></div>
      <div class="line"></div>
      ${openedAt ? `<div class="row"><span>Aberto às:</span><span>${openedAt.toLocaleTimeString('pt-BR')}</span></div>` : ''}
      <div class="row"><span>Fechado às:</span><span>${now.toLocaleTimeString('pt-BR')}</span></div>
      <div class="line" style="border-width:2px"></div>
      <div class="row bold"><span>FATURAMENTO</span><span>${fmt(totalRevenue)}</span></div>
      <div class="row"><span>Pedidos concluídos</span><span>${totalOrders}</span></div>
      <div class="row"><span>Ticket médio</span><span>${fmt(avgTicket)}</span></div>
      <div class="row"><span>Cancelados</span><span>${cancelledOrders.length}</span></div>
      <div class="line"></div>
      <h2 class="bold">POR PAGAMENTO</h2>
      ${byPayment.map(([method, data]) => `<div class="row"><span>${method} (${data.count})</span><span>${fmt(data.total)}</span></div>`).join('')}
      <div class="line"></div>
      <h2 class="bold">POR TIPO</h2>
      ${byType.map(([type, data]) => `<div class="row"><span>${typeLabels[type] || type} (${data.count})</span><span>${fmt(data.total)}</span></div>`).join('')}
      <div class="line"></div>
      <div class="center" style="margin-top:8px;font-size:10px">Impresso em ${now.toLocaleString('pt-BR')}</div>
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold">Controle de Caixa</h1>
              <p className="text-sm text-muted-foreground">
                {cashierOpen ? `Caixa aberto desde ${openedAt?.toLocaleTimeString('pt-BR')}` : 'Caixa fechado'}
              </p>
            </div>
            <div className="flex gap-2 self-start">
              {!cashierOpen ? (
                <button onClick={handleOpenCashier} className="rounded-lg bg-success px-4 py-2.5 text-sm font-bold text-white hover:bg-success/90 transition-colors">
                  Abrir Caixa
                </button>
              ) : (
                <button onClick={handleCloseCashier} className="rounded-lg bg-destructive px-4 py-2.5 text-sm font-bold text-white hover:bg-destructive/90 transition-colors">
                  Fechar Caixa
                </button>
              )}
              <button onClick={printReport} className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors" title="Imprimir relatório">
                🖨️
              </button>
              <button onClick={exportCSV} className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors" title="Exportar CSV">
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Faturamento', value: fmt(totalRevenue), icon: DollarSign, color: 'text-success' },
            { label: 'Pedidos concluídos', value: totalOrders, icon: CheckCircle, color: 'text-success' },
            { label: 'Ticket médio', value: fmt(avgTicket), icon: Clock, color: 'text-primary' },
            { label: 'Cancelados', value: cancelledOrders.length, icon: XCircle, color: 'text-destructive' },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 50}>
              <div className="card-elevated p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
                <p className="font-heading font-bold text-xl">{m.value}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <ScrollReveal>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-4">Por Forma de Pagamento</h3>
              {byPayment.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido concluído</p>
              ) : (
                <div className="space-y-3">
                  {byPayment.map(([method, data]) => (
                    <div key={method} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{method}</p>
                        <p className="text-xs text-muted-foreground">{data.count} pedidos</p>
                      </div>
                      <span className="font-heading font-bold">{fmt(data.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={60}>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-4">Por Tipo de Pedido</h3>
              {byType.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido concluído</p>
              ) : (
                <div className="space-y-3">
                  {byType.map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{typeLabels[type] || type}</p>
                        <p className="text-xs text-muted-foreground">{data.count} pedidos</p>
                      </div>
                      <span className="font-heading font-bold">{fmt(data.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal>
          <div className="card-elevated">
            <div className="p-5 pb-3 flex items-center justify-between">
              <h3 className="font-heading font-semibold">Pedidos em andamento ({pendingOrders.length})</h3>
            </div>
            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum pedido pendente</div>
            ) : (
              <div className="divide-y divide-border/60">
                {pendingOrders.map(order => (
                  <div key={order.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="font-heading font-bold shrink-0">#{order.number}</span>
                      <span className="text-sm text-muted-foreground truncate">{order.customer_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{typeLabels[order.type] || order.type}</span>
                    </div>
                    <span className="font-medium tabular-nums text-sm shrink-0">{fmt(Number(order.total))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </RestaurantLayout>
  );
}
