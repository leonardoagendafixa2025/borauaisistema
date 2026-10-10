import { useState, useRef, useCallback, useEffect } from 'react';
import { QrCode, Plus, Users, Eye, Edit2, Copy, Check, Download, Printer, Smartphone, XCircle, Trash2, ClipboardList, Wallet, UserSquare2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import PartialPaymentDialog from '@/components/PartialPaymentDialog';
import CommandsDialog from '@/components/CommandsDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useRestaurantTables, useRestaurant } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; class: string }> = {
  available: { label: 'Livre', class: 'bg-success/10 text-success' },
  occupied: { label: 'Ocupada', class: 'bg-destructive/10 text-destructive' },
  reserved: { label: 'Reservada', class: 'bg-warning/10 text-warning' },
  inactive: { label: 'Inativa', class: 'bg-muted text-muted-foreground' },
};

export default function TablesPage() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: tables = [], isLoading, refetch: refetchTables } = useRestaurantTables();
  const { data: restaurant } = useRestaurant();
  const [showQR, setShowQR] = useState<typeof tables[0] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showOrders, setShowOrders] = useState<typeof tables[0] | null>(null);
  const [showPartial, setShowPartial] = useState<typeof tables[0] | null>(null);
  const [showCommands, setShowCommands] = useState<typeof tables[0] | null>(null);
  const [copied, setCopied] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', label: '', capacity: '4' });
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  const baseUrl = window.location.origin;
  const slug = restaurant?.slug || 'restaurant';
  const getTableUrl = (t: typeof tables[0]) => `${baseUrl}/${slug}/mesa/${t.number}`;

  const copyLink = (t: typeof tables[0]) => {
    navigator.clipboard.writeText(getTableUrl(t));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = useCallback(() => {
    if (!showQR) return;
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-mesa-${showQR.number}.png`;
    a.click();
    toast.success('QR Code baixado!');
  }, [showQR]);

  const handlePrintQR = useCallback(() => {
    if (!showQR) return;
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code - Mesa ${showQR.number}</title>
      <style>
        body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:sans-serif; }
        img { width:300px; height:300px; }
        h2 { margin:16px 0 4px; font-size:22px; }
        p { color:#666; font-size:14px; margin:0; }
      </style></head><body>
        <h2>${restaurant?.name || 'Restaurante'}</h2>
        <p>Mesa ${showQR.number}${showQR.label ? ` — ${showQR.label}` : ''}</p>
        <img src="${dataUrl}" />
        <p style="margin-top:12px;font-size:12px;">Escaneie para ver o cardápio</p>
      </body></html>
    `);
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
  }, [showQR, restaurant]);

  const handleAddTable = async () => {
    if (!restaurantId) {
      toast.error('Restaurante não identificado');
      return;
    }

    const tableNumber = parseInt(newTable.number, 10);
    const tableCapacity = parseInt(newTable.capacity, 10) || 4;

    if (!newTable.number || Number.isNaN(tableNumber)) {
      toast.error('Informe um número de mesa válido');
      return;
    }

    const { data: existingTable, error: existingError } = await supabase
      .from('restaurant_tables')
      .select('id, status')
      .eq('restaurant_id', restaurantId)
      .eq('number', tableNumber)
      .maybeSingle();

    if (existingError) {
      toast.error(`Erro ao verificar mesa: ${existingError.message}`);
      return;
    }

    if (existingTable) {
      if (existingTable.status !== 'inactive') {
        toast.error(`Já existe uma mesa ativa com o número ${tableNumber}`);
        return;
      }

      const { error: reactivateError } = await supabase
        .from('restaurant_tables')
        .update({
          status: 'available',
          label: newTable.label || `Mesa ${tableNumber}`,
          capacity: tableCapacity,
        })
        .eq('id', existingTable.id);

      if (reactivateError) {
        toast.error(`Erro ao reativar mesa: ${reactivateError.message}`);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      await refetchTables();
      setShowAdd(false);
      setNewTable({ number: '', label: '', capacity: '4' });
      toast.success('Mesa reativada com sucesso!');
      return;
    }

    const { error } = await supabase.from('restaurant_tables').insert({
      restaurant_id: restaurantId,
      number: tableNumber,
      label: newTable.label || `Mesa ${tableNumber}`,
      capacity: tableCapacity,
      status: 'available',
    });

    if (error) {
      toast.error(`Erro ao criar mesa: ${error.message}`);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
    await refetchTables();
    setShowAdd(false);
    setNewTable({ number: '', label: '', capacity: '4' });
    toast.success('Mesa criada com sucesso!');
  };

  const [closingTableId, setClosingTableId] = useState<string | null>(null);
  const [justClosedId, setJustClosedId] = useState<string | null>(null);

  const handleCloseTable = async (tableId: string, tableLabel: string) => {
    if (!restaurantId) return;

    const [{ count: openOrders }, { count: openCommands }, { count: openPartials }] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('table_id', tableId).not('status', 'in', '(completed,cancelled)'),
      (supabase as any).from('table_commands').select('id', { count: 'exact', head: true })
        .eq('table_id', tableId).eq('status', 'open'),
      (supabase as any).from('table_partial_payments').select('id', { count: 'exact', head: true })
        .eq('table_id', tableId).eq('closed', false),
    ]);

    const summary: string[] = [];
    if (openOrders) summary.push(`${openOrders} pedido(s) em aberto`);
    if (openCommands) summary.push(`${openCommands} comanda(s) aberta(s)`);
    if (openPartials) summary.push(`${openPartials} pagamento(s) parcial(is)`);

    const msg = summary.length
      ? `Fechar ${tableLabel}?\n\nIsso vai:\n• Liberar a mesa (status: Livre)\n• Encerrar sessões ativas dos clientes\n• Finalizar: ${summary.join(', ')}\n\nConfirma?`
      : `Fechar ${tableLabel}?\n\nA mesa será liberada (status: Livre) e qualquer sessão ativa de cliente será encerrada.`;

    if (!confirm(msg)) return;

    setClosingTableId(tableId);
    try {
      await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId);
      await (supabase as any).from('table_sessions').update({ status: 'closed' })
        .eq('table_id', tableId).eq('status', 'active');
      await (supabase as any).from('table_commands').update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('table_id', tableId).eq('status', 'open');
      await (supabase as any).from('table_partial_payments').update({ closed: true })
        .eq('table_id', tableId).eq('closed', false);
      if (openOrders) {
        await supabase.from('orders').update({ status: 'completed' as any })
          .eq('table_id', tableId).not('status', 'in', '(completed,cancelled)');
      }

      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['table-partials-all', restaurantId] });
      refetchSessions();
      refetchPartials();

      setJustClosedId(tableId);
      setTimeout(() => setJustClosedId(null), 2500);

      toast.success(`✓ ${tableLabel} fechada e liberada`, {
        description: summary.length ? `Finalizado: ${summary.join(', ')}` : 'Mesa pronta para novo cliente',
      });
    } catch (err: any) {
      toast.error(`Erro ao fechar mesa: ${err?.message || 'tente novamente'}`);
    } finally {
      setClosingTableId(null);
    }
  };

  const handleDeleteTable = async (tableId: string, tableLabel: string) => {
    if (!restaurantId) return;
    if (!confirm(`Tem certeza que deseja excluir ${tableLabel}? Esta ação não pode ser desfeita.`)) return;

    // Check if table has historical orders — if so, soft-delete (mark inactive)
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('table_id', tableId);

    // Cleanup live references regardless
    await (supabase as any).from('table_sessions').delete().eq('table_id', tableId);
    await (supabase as any).from('waiter_calls').delete().eq('table_id', tableId);
    await (supabase as any).from('table_partial_payments').delete().eq('table_id', tableId);
    await (supabase as any).from('table_commands').delete().eq('table_id', tableId);

    if (ordersCount && ordersCount > 0) {
      // Soft-delete: keep historical integrity
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ status: 'inactive' })
        .eq('id', tableId);
      if (error) {
        toast.error(`Erro ao excluir: ${error.message}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
      toast.success(`${tableLabel} arquivada (possui histórico de pedidos)`);
      return;
    }

    const { error } = await supabase.from('restaurant_tables').delete().eq('id', tableId);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
    toast.success(`${tableLabel} excluída!`);
  };

  // Fetch active table sessions
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min heartbeat window
  const { data: activeSessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['table-sessions', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await (supabase as any)
        .from('table_sessions')
        .select('table_id, session_id, last_seen_at, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .gte('last_seen_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());
      return (data || []) as { table_id: string; session_id: string; last_seen_at: string; status: string }[];
    },
    enabled: !!restaurantId,
    refetchInterval: 60000,
  });

  // Realtime for sessions
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`table-sessions-rt-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        refetchSessions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, refetchSessions]);

  const getActiveCount = (tableId: string) => activeSessions.filter(s => s.table_id === tableId).length;

  // Fetch open partial payments for all tables (for badge)
  const { data: openPartials = [], refetch: refetchPartials } = useQuery({
    queryKey: ['table-partials-all', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await (supabase as any)
        .from('table_partial_payments')
        .select('table_id, amount, people_count')
        .eq('restaurant_id', restaurantId)
        .eq('closed', false);
      return (data || []) as { table_id: string; amount: number; people_count: number }[];
    },
    enabled: !!restaurantId,
    refetchInterval: 20000,
  });

  const getPartialInfo = (tableId: string) => {
    const list = openPartials.filter(p => p.table_id === tableId);
    if (list.length === 0) return null;
    const paid = list.reduce((s, p) => s + Number(p.amount || 0), 0);
    const people = list.reduce((s, p) => s + Number(p.people_count || 0), 0);
    return { paid, people, count: list.length };
  };

  // Fetch orders for selected table
  const { data: tableOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['table-orders', showOrders?.id],
    queryFn: async () => {
      if (!showOrders?.id) return [];
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('table_id', showOrders.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!showOrders?.id,
  });

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const statusLabels: Record<string, string> = { new: 'Novo', accepted: 'Aceito', preparing: 'Preparando', ready: 'Pronto', completed: 'Finalizado', cancelled: 'Cancelado', delivering: 'Entregando', waiting_pickup: 'Aguardando retirada' };

  const stats = {
    total: tables.filter(t => t.status !== 'inactive').length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    withClients: new Set(activeSessions.map(s => s.table_id)).size,
  };

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold">Mesas & QR Code</h1>
              <p className="text-sm text-muted-foreground">Gerencie as mesas e gere QR codes</p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Nova Mesa
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total ativas', value: stats.total, icon: QrCode },
              { label: 'Livres agora', value: stats.available, icon: Users },
              { label: 'Ocupadas', value: stats.occupied, icon: Eye },
              { label: 'Com clientes', value: stats.withClients, icon: Smartphone },
            ].map((s, i) => (
              <div key={i} className="card-elevated p-4 text-center">
                <s.icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {isLoading ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <ScrollReveal>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.filter(t => t.status !== 'inactive').map(t => {
                const st = statusConfig[t.status] || statusConfig.available;
                const activeCount = getActiveCount(t.id);
                const partial = getPartialInfo(t.id);
                const isBusy = activeCount > 0 || !!partial || t.status === 'occupied';
                const isClosing = closingTableId === t.id;
                const justClosed = justClosedId === t.id;
                return (
                  <div key={t.id} className={`card-elevated p-4 space-y-3 transition-all duration-300 relative
                    ${justClosed ? 'ring-4 ring-success bg-success/5 scale-[1.02]' : ''}
                    ${!justClosed && isBusy ? 'ring-2 ring-primary/40' : ''}
                    ${!justClosed && partial ? 'ring-2 ring-warning/50' : ''}
                    ${!justClosed && !isBusy && t.status === 'available' ? 'border-l-4 border-l-success' : ''}
                  `}>
                    {justClosed && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-bounce">
                        <Check className="h-3 w-3" /> Fechada
                      </div>
                    )}
                    {!justClosed && activeCount > 0 && (
                      <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        <Smartphone className="h-3 w-3" /> {activeCount} {activeCount === 1 ? 'cliente' : 'clientes'}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-lg">#{t.number}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.class}`}>
                        {t.status === 'available' ? '🟢' : t.status === 'occupied' ? '🔴' : '🟡'} {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />{t.capacity} lugares</p>
                    {partial && (
                      <div className="flex items-center justify-between text-[11px] bg-warning/10 text-warning rounded-md px-2 py-1">
                        <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> {partial.people} pagaram</span>
                        <span className="font-bold tabular-nums">{partial.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    )}
                    <div className="space-y-1.5 pt-1">
                      <button onClick={() => setShowQR(t)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-2 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                        <QrCode className="h-3.5 w-3.5" /> QR Code
                      </button>
                      <div className="grid grid-cols-5 gap-1">
                        <button onClick={() => setShowCommands(t)}
                          title="Comandas individuais"
                          aria-label="Comandas individuais"
                          className="inline-flex items-center justify-center py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary">
                          <UserSquare2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setShowPartial(t)}
                          title="Pagamento parcial / dividir conta"
                          aria-label="Pagamento parcial"
                          className="inline-flex items-center justify-center py-2 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors text-warning">
                          <Wallet className="h-4 w-4" />
                        </button>
                        <button onClick={() => setShowOrders(t)}
                          title="Ver pedidos"
                          aria-label="Ver pedidos"
                          className="inline-flex items-center justify-center py-2 rounded-lg bg-accent hover:bg-accent/80 transition-colors text-accent-foreground">
                          <ClipboardList className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleCloseTable(t.id, t.label || `Mesa ${t.number}`)}
                          disabled={isClosing || (!isBusy && t.status === 'available')}
                          title={!isBusy && t.status === 'available' ? 'Mesa já está livre' : 'Fechar mesa e liberar'}
                          aria-label="Fechar mesa"
                          className="inline-flex items-center justify-center py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors text-destructive disabled:opacity-40 disabled:cursor-not-allowed">
                          {isClosing ? <span className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" /> : <XCircle className="h-4 w-4" />}
                        </button>
                        <button onClick={() => handleDeleteTable(t.id, t.label || `Mesa ${t.number}`)}
                          title="Excluir mesa"
                          aria-label="Excluir mesa"
                          className="inline-flex items-center justify-center py-2 rounded-lg bg-muted hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollReveal>
        )}
      </div>

      {/* QR Code Dialog */}
      <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - {showQR?.label}</DialogTitle>
            <DialogDescription>Imprima e cole na mesa para o cliente acessar o cardápio</DialogDescription>
          </DialogHeader>
          {showQR && (
            <div className="space-y-4">
              <div className="mx-auto w-64 h-64 bg-white rounded-xl flex items-center justify-center p-4">
                <QRCodeCanvas
                  id="qr-canvas"
                  value={getTableUrl(showQR)}
                  size={224}
                  level="H"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="text-center text-sm font-medium text-foreground">Mesa {showQR.number}{showQR.label ? ` — ${showQR.label}` : ''}</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <code className="flex-1 text-xs truncate">{getTableUrl(showQR)}</code>
                <button onClick={() => copyLink(showQR)} className="p-1.5 rounded hover:bg-background transition-colors">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={handleDownloadQR}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Download className="h-4 w-4" /> Baixar PNG
                </button>
                <button onClick={handlePrintQR}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Table Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Mesa</DialogTitle>
            <DialogDescription>Adicione uma nova mesa ao estabelecimento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Número da mesa</label>
              <input type="number" placeholder="Ex: 13" value={newTable.number} onChange={e => setNewTable(p => ({ ...p, number: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Rótulo (opcional)</label>
              <input type="text" placeholder="Ex: VIP 3" value={newTable.label} onChange={e => setNewTable(p => ({ ...p, label: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Capacidade</label>
              <input type="number" value={newTable.capacity} onChange={e => setNewTable(p => ({ ...p, capacity: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <button onClick={handleAddTable}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Criar Mesa
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table Orders Dialog */}
      <Dialog open={!!showOrders} onOpenChange={() => setShowOrders(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedidos - {showOrders?.label || `Mesa ${showOrders?.number}`}</DialogTitle>
            <DialogDescription>Histórico de pedidos desta mesa</DialogDescription>
          </DialogHeader>
          {loadingOrders ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : tableOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pedido para esta mesa</p>
          ) : (
            <div className="space-y-3">
              {tableOrders.map((order: any) => (
                <div key={order.id} className="card-elevated p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Pedido #{order.number}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      order.status === 'completed' ? 'bg-success/10 text-success' :
                      order.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    }`}>{statusLabels[order.status] || order.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                  <div className="space-y-1">
                    {(order.order_items || []).map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span>{item.qty}x {item.name}</span>
                        <span className="text-muted-foreground">{formatCurrency(Number(item.total_price))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                    <span>Total</span>
                    <span>{formatCurrency(Number(order.total))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Partial Payment Dialog */}
      <PartialPaymentDialog
        open={!!showPartial}
        onOpenChange={(o) => { if (!o) setShowPartial(null); }}
        table={showPartial}
        onTableClosed={() => { refetchPartials(); refetchSessions(); }}
      />

      {/* Commands Dialog */}
      <CommandsDialog
        open={!!showCommands}
        onOpenChange={(o) => { if (!o) setShowCommands(null); }}
        table={showCommands}
      />
    </RestaurantLayout>
  );
}
