import { useState, useMemo } from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Printer,
  Plus,
  Wallet,
  AlertTriangle,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurant } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CashierPage() {
  const { restaurantId, user } = useAuth();
  const { data: restaurant } = useRestaurant();
  const queryClient = useQueryClient();

  // Active cashier session
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

  // Window-based Orders: when session is open, query since opened_at across midnight!
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['cashier-orders', restaurantId, activeSession?.id, activeSession?.opened_at],
    queryFn: async () => {
      if (!restaurantId) return [];
      let q = supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (activeSession?.opened_at) {
        q = q.gte('created_at', activeSession.opened_at);
      } else {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        q = q.gte('created_at', todayStart.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Cash movements (suprimentos e sangrias) for active session
  const { data: movements = [], refetch: refetchMovements } = useQuery({
    queryKey: ['cashier-movements', activeSession?.id],
    queryFn: async () => {
      if (!activeSession?.id) return [];
      const { data, error } = await (supabase as any)
        .from('cashier_movements')
        .select('*')
        .eq('session_id', activeSession.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!activeSession?.id,
  });

  // Past closed sessions history
  const { data: pastSessions = [] } = useQuery({
    queryKey: ['cashier-past-sessions', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('cashier_sessions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .not('closed_at', 'is', null)
        .order('opened_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Modals state
  const [openCashierModal, setOpenCashierModal] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState('0,00');
  const [openNotesInput, setOpenNotesInput] = useState('');

  const [movementModal, setMovementModal] = useState<{ open: boolean; type: 'supply' | 'bleed' }>({ open: false, type: 'supply' });
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const [closeCashierModal, setCloseCashierModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [closeNotesInput, setCloseNotesInput] = useState('');

  const [viewHistoryModal, setViewHistoryModal] = useState(false);
  const [selectedPastSession, setSelectedPastSession] = useState<any>(null);

  // Active Session Order Breakdown
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);
  const cancelledOrders = useMemo(() => orders.filter(o => o.status === 'cancelled'), [orders]);
  const pendingOrders = useMemo(() => orders.filter(o => !['completed', 'cancelled'].includes(o.status)), [orders]);

  const totalRevenue = useMemo(() => completedOrders.reduce((s, o) => s + Number(o.total || 0), 0), [completedOrders]);
  const totalOrders = completedOrders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Breakdown by payment
  const byPayment = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    completedOrders.forEach(o => {
      const method = o.payment_method || 'Não informado';
      if (!map[method]) map[method] = { count: 0, total: 0 };
      map[method].count++;
      map[method].total += Number(o.total || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [completedOrders]);

  // Cash sales calculation
  const cashSales = useMemo(() => {
    return completedOrders
      .filter(o => {
        const m = (o.payment_method || '').toLowerCase();
        return m.includes('dinheiro') || m === 'cash';
      })
      .reduce((s, o) => s + Number(o.total || 0), 0);
  }, [completedOrders]);

  // Drawer calculations
  const initialCash = Number(activeSession?.initial_cash || 0);
  const totalSupplies = useMemo(() => movements.filter((m: any) => m.type === 'supply').reduce((s: number, m: any) => s + Number(m.amount || 0), 0), [movements]);
  const totalBleeds = useMemo(() => movements.filter((m: any) => m.type === 'bleed').reduce((s: number, m: any) => s + Number(m.amount || 0), 0), [movements]);
  const currentExpectedDrawerCash = initialCash + cashSales + totalSupplies - totalBleeds;

  const typeLabels: Record<string, string> = { delivery: 'Delivery', pickup: 'Retirada', dine_in: 'Mesa' };

  // Actions
  const handleOpenCashierSubmit = async () => {
    if (!restaurantId || !user) return;
    const initialNum = Number(initialCashInput.replace(/\./g, '').replace(',', '.')) || 0;
    const { error } = await supabase.from('cashier_sessions').insert({
      restaurant_id: restaurantId,
      opened_by: user.id,
      initial_cash: initialNum,
      notes: openNotesInput.trim() || null,
    });
    if (error) {
      toast.error('Erro ao abrir caixa: ' + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['cashier-session', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['cashier-orders'] });
    setOpenCashierModal(false);
    setInitialCashInput('0,00');
    setOpenNotesInput('');
    toast.success(`Caixa aberto com fundo inicial de ${fmt(initialNum)}! 🚀`);
  };

  const handleAddMovement = async () => {
    if (!activeSession || !user) return;
    const amountNum = Number(movementAmount.replace(/\./g, '').replace(',', '.'));
    if (!amountNum || amountNum <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }
    if (!movementReason.trim()) {
      toast.error('Informe a justificativa/motivo.');
      return;
    }
    if (movementModal.type === 'bleed' && amountNum > currentExpectedDrawerCash) {
      toast.warning(`Atenção: sangria maior que o saldo atual da gaveta (${fmt(currentExpectedDrawerCash)}).`);
    }

    const { error } = await (supabase as any).from('cashier_movements').insert({
      session_id: activeSession.id,
      restaurant_id: restaurantId,
      type: movementModal.type,
      amount: amountNum,
      reason: movementReason.trim(),
      created_by: user.id,
    });

    if (error) {
      toast.error('Erro ao registrar movimentação: ' + error.message);
      return;
    }

    // Log in financial_transactions as expense if bleed
    if (movementModal.type === 'bleed') {
      await (supabase as any).from('financial_transactions').insert({
        restaurant_id: restaurantId,
        amount: amountNum,
        type: 'refund',
        description: `Sangria de caixa: ${movementReason.trim()}`,
      });
    }

    toast.success(`${movementModal.type === 'supply' ? 'Suprimento (+)' : 'Sangria (-)'} de ${fmt(amountNum)} registrado!`);
    refetchMovements();
    queryClient.invalidateQueries({ queryKey: ['cashier-movements', activeSession.id] });
    setMovementModal({ open: false, type: 'supply' });
    setMovementAmount('');
    setMovementReason('');
  };

  const handleCloseCashierSubmit = async () => {
    if (!activeSession || !user) return;
    const countedNum = Number(countedCashInput.replace(/\./g, '').replace(',', '.'));
    if (countedCashInput === '' || isNaN(countedNum)) {
      toast.error('Informe o valor total de dinheiro contado na gaveta.');
      return;
    }

    const cashDifference = countedNum - currentExpectedDrawerCash;

    const { error } = await supabase.from('cashier_sessions').update({
      closed_at: new Date().toISOString(),
      closed_by: user.id,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      closed_cash: countedNum,
      expected_cash: currentExpectedDrawerCash,
      cash_difference: cashDifference,
      notes: closeNotesInput.trim() || null,
    }).eq('id', activeSession.id);

    if (error) {
      toast.error('Erro ao fechar caixa: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['cashier-session', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['cashier-past-sessions', restaurantId] });
    setCloseCashierModal(false);
    setCountedCashInput('');
    setCloseNotesInput('');

    if (Math.abs(cashDifference) < 0.01) {
      toast.success('Caixa fechado com sucesso! Conferência exata sem quebra. 🎉');
    } else if (cashDifference > 0) {
      toast.success(`Caixa fechado com sobra de ${fmt(cashDifference)}.`);
    } else {
      toast.warning(`Caixa fechado com quebra/falta de ${fmt(Math.abs(cashDifference))}.`);
    }
  };

  const exportCSV = () => {
    const headers = 'Pedido,Tipo,Cliente,Total,Pagamento,Status,Hora\n';
    const rows = orders.map(o =>
      `#${o.number},${typeLabels[o.type] || o.type},"${o.customer_name}",${Number(o.total || 0).toFixed(2)},${o.payment_method || '-'},${o.status},${new Date(o.created_at).toLocaleTimeString('pt-BR')}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caixa-${restaurant?.slug || 'restaurante'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exportação CSV gerada!');
  };

  const printReport = (sessionData?: any) => {
    const targetSession = sessionData || activeSession;
    const now = new Date();
    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) return;

    const sessionStart = targetSession?.opened_at ? new Date(targetSession.opened_at) : null;
    const sessionEnd = targetSession?.closed_at ? new Date(targetSession.closed_at) : now;

    printWindow.document.write(`
      <html><head><title>Fechamento de Caixa — ${restaurant?.name || 'Bora Uai'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; padding: 4mm; color: #000; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 6px 0; }
        .line-double { border-bottom: 2px solid #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        h1 { font-size: 15px; margin-bottom: 2px; }
        h2 { font-size: 13px; margin: 6px 0 2px; }
      </style></head><body>
      <div class="center">
        <h1>${restaurant?.name || 'BORA UAI RESTAURANTE'}</h1>
        <p>FECHAMENTO DE CAIXA</p>
      </div>
      <div class="line"></div>
      ${sessionStart ? `<div class="row"><span>Abertura:</span><span>${sessionStart.toLocaleDateString('pt-BR')} ${sessionStart.toLocaleTimeString('pt-BR')}</span></div>` : ''}
      <div class="row"><span>Fechamento:</span><span>${sessionEnd.toLocaleDateString('pt-BR')} ${sessionEnd.toLocaleTimeString('pt-BR')}</span></div>
      <div class="line-double"></div>

      <div class="row bold"><span>FATURAMENTO TOTAL</span><span>${fmt(sessionData ? Number(sessionData.total_revenue) : totalRevenue)}</span></div>
      <div class="row"><span>Pedidos Concluídos</span><span>${sessionData ? sessionData.total_orders : totalOrders}</span></div>
      <div class="row"><span>Ticket Médio</span><span>${fmt(sessionData ? (sessionData.total_revenue / (sessionData.total_orders || 1)) : avgTicket)}</span></div>
      <div class="row"><span>Cancelados</span><span>${cancelledOrders.length}</span></div>

      <div class="line"></div>
      <h2 class="bold">MOVIMENTAÇÃO DE GAVETA</h2>
      <div class="row"><span>(+) Fundo Inicial:</span><span>${fmt(Number(targetSession?.initial_cash || 0))}</span></div>
      <div class="row"><span>(+) Vendas Dinheiro:</span><span>${fmt(cashSales)}</span></div>
      <div class="row"><span>(+) Suprimentos:</span><span>${fmt(totalSupplies)}</span></div>
      <div class="row"><span>(-) Sangrias:</span><span>-${fmt(totalBleeds)}</span></div>
      <div class="line"></div>
      <div class="row bold"><span>(=) DINHEIRO ESPERADO:</span><span>${fmt(targetSession?.expected_cash ? Number(targetSession.expected_cash) : currentExpectedDrawerCash)}</span></div>
      ${targetSession?.closed_cash !== null && targetSession?.closed_cash !== undefined ? `
        <div class="row bold"><span>(=) DINHEIRO CONTADO:</span><span>${fmt(Number(targetSession.closed_cash))}</span></div>
        <div class="row bold"><span>DIFERENÇA / QUEBRA:</span><span>${Number(targetSession.cash_difference) >= 0 ? '+' : ''}${fmt(Number(targetSession.cash_difference || 0))}</span></div>
      ` : ''}

      <div class="line"></div>
      <h2 class="bold">POR FORMA DE PAGAMENTO</h2>
      ${byPayment.map(([method, data]) => `<div class="row"><span>${method} (${data.count})</span><span>${fmt(data.total)}</span></div>`).join('')}

      ${movements.length > 0 ? `
        <div class="line"></div>
        <h2 class="bold">SANGRÍAS / SUPRIMENTOS</h2>
        ${movements.map((m: any) => `
          <div class="row">
            <span>${m.type === 'supply' ? '[SUP]' : '[SAN]'} ${m.reason}</span>
            <span>${fmt(Number(m.amount))}</span>
          </div>
        `).join('')}
      ` : ''}

      <div class="line"></div>
      <div class="center" style="margin-top:8px;font-size:10px">
        Impresso em ${now.toLocaleString('pt-BR')}<br />
        Bora Uai Tecnologia para Restaurantes
      </div>
      <script>window.print(); setTimeout(() => window.close(), 1000);</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Controle de Caixa</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  cashierOpen ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${cashierOpen ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                  {cashierOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {cashierOpen
                  ? `Sessão ativa desde ${openedAt?.toLocaleDateString('pt-BR')} às ${openedAt?.toLocaleTimeString('pt-BR')}`
                  : 'Nenhum turno em andamento. Abra o caixa para operar o salão e delivery.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!cashierOpen ? (
                <button
                  onClick={() => setOpenCashierModal(true)}
                  className="rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-success/20 hover:bg-success/90 active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Abrir Caixa
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setMovementModal({ open: true, type: 'supply' })}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted/60 transition-colors flex items-center gap-1.5"
                    title="Adicionar troco na gaveta"
                  >
                    <ArrowDownRight className="h-3.5 w-3.5 text-success" /> + Suprimento
                  </button>
                  <button
                    onClick={() => setMovementModal({ open: true, type: 'bleed' })}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted/60 transition-colors flex items-center gap-1.5"
                    title="Retirar dinheiro da gaveta para cofre"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-destructive" /> - Sangria
                  </button>
                  <button
                    onClick={() => setCloseCashierModal(true)}
                    className="rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90 active:scale-[0.98] transition-all"
                  >
                    Fechar Caixa
                  </button>
                </>
              )}

              <button
                onClick={() => printReport()}
                disabled={!cashierOpen && orders.length === 0}
                className="rounded-xl border border-border p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                title="Imprimir comprovante térmico"
              >
                <Printer className="h-4 w-4" />
              </button>

              <button
                onClick={exportCSV}
                disabled={orders.length === 0}
                className="rounded-xl border border-border p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                title="Exportar planilha CSV"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </button>

              <button
                onClick={() => setViewHistoryModal(true)}
                className="rounded-xl border border-border px-3 py-2.5 text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                title="Ver fechamentos anteriores"
              >
                <History className="h-4 w-4" /> Turnos Passados
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* Real-time KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Faturamento do Turno', value: fmt(totalRevenue), icon: DollarSign, color: 'text-success' },
            { label: 'Pedidos Concluídos', value: totalOrders, icon: CheckCircle, color: 'text-success' },
            { label: 'Ticket Médio', value: fmt(avgTicket), icon: Clock, color: 'text-primary' },
            { label: 'Saldo Gaveta (Dinheiro)', value: fmt(currentExpectedDrawerCash), icon: Wallet, color: 'text-warning' },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 50}>
              <div className="card-elevated p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                  <span className="text-xs text-muted-foreground font-medium">{m.label}</span>
                </div>
                <p className="font-heading font-extrabold text-xl sm:text-2xl tabular-nums">{m.value}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Drawer cash breakdown */}
        {cashierOpen && (
          <ScrollReveal delay={120}>
            <div className="card-elevated p-5 border-l-4 border-l-warning">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-warning" />
                  <h3 className="font-heading font-bold text-base">Composição do Dinheiro em Espécie (Gaveta)</h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  Fórmula: Fundo + Vendas Dinheiro + Suprimentos - Sangrias
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">Fundo Inicial</span>
                  <span className="font-bold tabular-nums text-foreground">{fmt(initialCash)}</span>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">(+) Vendas Dinheiro</span>
                  <span className="font-bold tabular-nums text-success">{fmt(cashSales)}</span>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">(+) Suprimentos</span>
                  <span className="font-bold tabular-nums text-primary">+{fmt(totalSupplies)}</span>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">(-) Sangrias</span>
                  <span className="font-bold tabular-nums text-destructive">-{fmt(totalBleeds)}</span>
                </div>
                <div className="rounded-xl bg-warning/10 p-3 col-span-2 sm:col-span-1 border border-warning/20">
                  <span className="text-xs text-warning block font-semibold">(=) Esperado em Mãos</span>
                  <span className="font-extrabold tabular-nums text-warning text-base">{fmt(currentExpectedDrawerCash)}</span>
                </div>
              </div>

              {movements.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/60">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-2">
                    Movimentações deste turno ({movements.length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {movements.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            m.type === 'supply' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                          }`}>
                            {m.type === 'supply' ? 'SUPRIMENTO' : 'SANGRIA'}
                          </span>
                          <span className="text-foreground">{m.reason}</span>
                          <span className="text-muted-foreground">· {new Date(m.created_at).toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <span className={`font-bold tabular-nums ${m.type === 'supply' ? 'text-success' : 'text-destructive'}`}>
                          {m.type === 'supply' ? '+' : '-'}{fmt(Number(m.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollReveal>
        )}

        {/* Breakdown by Payment Method & Order Type */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ScrollReveal>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-4 flex items-center justify-between">
                <span>Por Forma de Pagamento</span>
                <span className="text-xs font-normal text-muted-foreground">{completedOrders.length} pedidos pagos</span>
              </h3>
              {byPayment.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pedido concluído neste turno.</p>
              ) : (
                <div className="space-y-3">
                  {byPayment.map(([method, data]) => {
                    const pct = totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0;
                    return (
                      <div key={method} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-semibold capitalize">{method}</span>
                            <span className="text-xs text-muted-foreground ml-2">({data.count} pedidos · {pct.toFixed(1)}%)</span>
                          </div>
                          <span className="font-heading font-bold tabular-nums">{fmt(data.total)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={60}>
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-4 flex items-center justify-between">
                <span>Pedidos em Andamento ({pendingOrders.length})</span>
                <span className="text-xs font-normal text-muted-foreground">Não computados no faturamento</span>
              </h3>
              {pendingOrders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum pedido pendente de conclusão no momento.
                </div>
              ) : (
                <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
                  {pendingOrders.map(order => (
                    <div key={order.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-heading font-bold text-sm shrink-0">#{order.number}</span>
                        <span className="text-xs text-muted-foreground truncate">{order.customer_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium shrink-0">
                          {typeLabels[order.type] || order.type}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums text-sm shrink-0">{fmt(Number(order.total))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>

        {/* Modal: Abertura de Caixa */}
        <Dialog open={openCashierModal} onOpenChange={setOpenCashierModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-success" />
                Abertura de Caixa
              </DialogTitle>
              <DialogDescription>
                Informe o valor disponível na gaveta (fundo de troco) antes de iniciar as operações.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Fundo de Troco Inicial (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">R$</span>
                  <input
                    type="text"
                    value={initialCashInput}
                    onChange={e => setInitialCashInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-border pl-10 pr-4 py-2 text-base font-bold bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Exemplo: notas e moedas deixadas na gaveta no início do turno.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Observações de Abertura (Opcional)
                </label>
                <input
                  type="text"
                  value={openNotesInput}
                  onChange={e => setOpenNotesInput(e.target.value)}
                  placeholder="Ex: Turno da Noite / Garçom Carlos"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setOpenCashierModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleOpenCashierSubmit}
                  className="rounded-xl bg-success px-4 py-2 text-sm font-bold text-white hover:bg-success/90"
                >
                  Confirmar e Abrir
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: Suprimento / Sangria */}
        <Dialog open={movementModal.open} onOpenChange={open => setMovementModal(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {movementModal.type === 'supply' ? (
                  <>
                    <ArrowDownRight className="h-5 w-5 text-success" />
                    Registrar Suprimento (+)
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-5 w-5 text-destructive" />
                    Registrar Sangria (-)
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {movementModal.type === 'supply'
                  ? 'Entrada de troco ou reforço de dinheiro na gaveta.'
                  : 'Retirada de cédulas da gaveta para segurança ou pagamento de despesa.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Valor (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">R$</span>
                  <input
                    type="text"
                    value={movementAmount}
                    onChange={e => setMovementAmount(e.target.value)}
                    placeholder="50,00"
                    className="w-full rounded-xl border border-border pl-10 pr-4 py-2 text-base font-bold bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Justificativa / Motivo *
                </label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={e => setMovementReason(e.target.value)}
                  placeholder={movementModal.type === 'supply' ? 'Ex: Moedas trocadas no banco' : 'Ex: Recolhimento para cofre / despesa gelo'}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setMovementModal({ open: false, type: 'supply' })}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddMovement}
                  className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${
                    movementModal.type === 'supply' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'
                  }`}
                >
                  Salvar Movimentação
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: Fechamento com Conferência Cega */}
        <Dialog open={closeCashierModal} onOpenChange={setCloseCashierModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-destructive" />
                Fechamento de Caixa e Conferência
              </DialogTitle>
              <DialogDescription>
                Confira os valores antes de encerrar o turno. Insira o valor físico em dinheiro apurado na gaveta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm p-3 rounded-xl bg-muted/40">
                <div>
                  <span className="text-xs text-muted-foreground block">Faturamento Total</span>
                  <span className="font-bold tabular-nums text-foreground">{fmt(totalRevenue)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Pedidos Concluídos</span>
                  <span className="font-bold tabular-nums text-foreground">{totalOrders}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Vendas em Dinheiro</span>
                  <span className="font-bold tabular-nums text-success">{fmt(cashSales)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Dinheiro Esperado na Gaveta</span>
                  <span className="font-extrabold tabular-nums text-warning">{fmt(currentExpectedDrawerCash)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Valor Contado na Gaveta (Dinheiro Físico) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">R$</span>
                  <input
                    type="text"
                    value={countedCashInput}
                    onChange={e => setCountedCashInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-border pl-10 pr-4 py-2 text-base font-bold bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {countedCashInput !== '' && !isNaN(Number(countedCashInput.replace(/\./g, '').replace(',', '.'))) && (
                (() => {
                  const counted = Number(countedCashInput.replace(/\./g, '').replace(',', '.'));
                  const diff = counted - currentExpectedDrawerCash;
                  return (
                    <div className={`p-3 rounded-xl text-sm border flex items-center justify-between ${
                      Math.abs(diff) < 0.01
                        ? 'bg-success/10 border-success/30 text-success'
                        : diff > 0
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-destructive/10 border-destructive/30 text-destructive'
                    }`}>
                      <div>
                        <span className="font-bold block">
                          {Math.abs(diff) < 0.01 ? '✓ Caixa Perfeito' : diff > 0 ? 'Sobra de Caixa' : '⚠ Falta / Quebra de Caixa'}
                        </span>
                        <span className="text-xs opacity-90">
                          {Math.abs(diff) < 0.01 ? 'O valor contado bate com o esperado.' : diff > 0 ? 'Há mais dinheiro do que o registrado.' : 'Falta dinheiro na gaveta.'}
                        </span>
                      </div>
                      <span className="font-extrabold text-base tabular-nums">
                        {diff >= 0 ? '+' : ''}{fmt(diff)}
                      </span>
                    </div>
                  );
                })()
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Observações do Fechamento
                </label>
                <textarea
                  value={closeNotesInput}
                  onChange={e => setCloseNotesInput(e.target.value)}
                  placeholder="Ex: Diferença de R$ 2,00 por arredondamento de troco."
                  rows={2}
                  className="w-full rounded-xl border border-border p-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setCloseCashierModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCloseCashierSubmit}
                  className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-white hover:bg-destructive/90"
                >
                  Confirmar e Encerrar Caixa
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: Histórico de Turnos Anteriores */}
        <Dialog open={viewHistoryModal} onOpenChange={setViewHistoryModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Turnos Anteriores
              </DialogTitle>
              <DialogDescription>
                Visualize os fechamentos passados com quebra de caixa e comprovantes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {pastSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum turno anterior registrado.</p>
              ) : (
                pastSessions.map(sess => {
                  const sOpen = new Date(sess.opened_at);
                  const sClose = sess.closed_at ? new Date(sess.closed_at) : null;
                  const diff = Number(sess.cash_difference || 0);
                  return (
                    <div key={sess.id} className="p-4 rounded-xl border border-border hover:border-primary/50 transition-all bg-card/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">
                            {sOpen.toLocaleDateString('pt-BR')} — {sOpen.toLocaleTimeString('pt-BR')} até {sClose?.toLocaleTimeString('pt-BR') || '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sess.total_orders} pedidos concluídos · Fundo inicial: {fmt(Number(sess.initial_cash || 0))}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-heading font-extrabold text-base block">{fmt(Number(sess.total_revenue || 0))}</span>
                          <span className={`text-xs font-semibold ${
                            Math.abs(diff) < 0.01 ? 'text-success' : diff > 0 ? 'text-primary' : 'text-destructive'
                          }`}>
                            {Math.abs(diff) < 0.01 ? '✓ Sem quebra' : `Quebra: ${diff >= 0 ? '+' : ''}${fmt(diff)}`}
                          </span>
                        </div>
                      </div>

                      {sess.notes && (
                        <p className="text-xs text-muted-foreground italic bg-muted/40 p-2 rounded-lg">
                          “{sess.notes}”
                        </p>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => printReport(sess)}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <Printer className="h-3 w-3" /> Imprimir Relatório
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RestaurantLayout>
  );
}
