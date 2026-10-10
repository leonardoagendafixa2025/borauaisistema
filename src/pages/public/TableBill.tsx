import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Bell, HandCoins, Receipt, ChefHat, CheckCircle, Clock, Package, Loader2, Users, Split } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { usePublicRestaurant, usePublicSettings, usePublicTables } from '@/hooks/useRestaurantData';
import { useRestaurantTheme } from '@/hooks/useRestaurantTheme';
import { toast } from 'sonner';
import SplitBillDialog from '@/components/SplitBillDialog';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  new: { label: 'Recebido', icon: Clock, cls: 'bg-muted text-foreground' },
  accepted: { label: 'Aceito', icon: CheckCircle, cls: 'bg-primary/15 text-primary' },
  preparing: { label: 'Em preparo', icon: ChefHat, cls: 'bg-warning/15 text-warning' },
  ready: { label: 'Pronto', icon: Package, cls: 'bg-success/15 text-success' },
  completed: { label: 'Entregue', icon: CheckCircle, cls: 'bg-success/15 text-success' },
};

interface OrderRow {
  id: string;
  number: number;
  status: string;
  type: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  payment_status: string | null;
  payment_method: string | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    unit_price: number;
    total_price: number;
    options: any;
    notes: string | null;
  }>;
}

export default function TableBill() {
  const { slug, tableNumber } = useParams<{ slug: string; tableNumber: string }>();
  const navigate = useNavigate();
  const { data: restaurant } = usePublicRestaurant(slug);
  const { data: settings } = usePublicSettings(restaurant?.id);
  const { data: tables = [] } = usePublicTables(restaurant?.id);
  useRestaurantTheme(settings?.primary_color, settings?.secondary_color);

  const table = useMemo(
    () => tables.find((t: any) => String(t.number) === String(tableNumber)) || null,
    [tables, tableNumber]
  );

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [showBillConfirm, setShowBillConfirm] = useState(false);
  const [callSent, setCallSent] = useState(false);
  const [billSent, setBillSent] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  const fetchOrders = async () => {
    if (!restaurant?.id || !table?.id) return;
    setRefreshing(true);
    const { data, error } = await (publicSupabase as any).rpc('get_table_open_orders', {
      _restaurant_id: restaurant.id,
      _table_id: table.id,
    });
    if (!error && data) setOrders(data as OrderRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!restaurant?.id || !table?.id) return;
    fetchOrders();

    const channel = publicSupabase
      .channel(`table-bill-${table.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${table.id}` },
        () => fetchOrders()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `table_id=eq.${table.id}` },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'attended') {
            toast.success('✅ O garçom já está indo até sua mesa!', { duration: 8000 });
          }
        }
      )
      .subscribe();

    const interval = setInterval(fetchOrders, 30000);
    return () => {
      publicSupabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id, table?.id]);

  const activeOrders = orders.filter(o => o.status !== 'completed');
  const completedOrders = orders.filter(o => o.status === 'completed');

  const subtotalAll = orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const couvertValue = settings?.couvert_enabled ? Number(settings.couvert_value || 0) : 0;
  const serviceFeePercent = Number(settings?.service_fee_percent || 10);
  const serviceFee = settings?.service_fee_enabled ? subtotalAll * serviceFeePercent / 100 : 0;
  const grandTotal = subtotalAll + couvertValue + serviceFee;

  const callWaiter = async () => {
    if (!restaurant?.id || !table?.id) return;
    setShowCallConfirm(false);
    await publicSupabase.from('waiter_calls').insert({ restaurant_id: restaurant.id, table_id: table.id, type: 'call_waiter' });
    setCallSent(true);
    toast.success('🔔 Garçom chamado! Aguarde um momento.');
    setTimeout(() => setCallSent(false), 60000);
  };

  const requestBill = async () => {
    if (!restaurant?.id || !table?.id) return;
    setShowBillConfirm(false);
    await publicSupabase.from('waiter_calls').insert({ restaurant_id: restaurant.id, table_id: table.id, type: 'request_bill' });
    setBillSent(true);
    toast.success('💰 Conta solicitada! Aguarde um momento.');
    setTimeout(() => setBillSent(false), 60000);
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div>
          <h1 className="font-heading text-xl font-bold mb-2">Mesa não encontrada</h1>
          <Link to={`/${slug}`} className="text-primary hover:underline">Voltar ao cardápio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background pb-32 font-public">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/${slug}/mesa/${tableNumber}`)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Voltar ao cardápio"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-lg truncate">Minha Mesa</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
                {restaurant.name} · Mesa {tableNumber} {refreshing && '· atualizando…'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="card-elevated p-8 text-center space-y-3">
            <Receipt className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <h2 className="font-heading font-bold">Nenhum pedido ainda</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Faça seu primeiro pedido e ele aparecerá aqui em tempo real.
              </p>
            </div>
            <button
              onClick={() => navigate(`/${slug}/mesa/${tableNumber}`)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Ver cardápio
            </button>
          </div>
        ) : (
          <>
            {/* Resumo */}
            <div className="card-elevated p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Conta da mesa
                </h2>
                <span className="text-xs text-muted-foreground">{orders.length} pedido{orders.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span className="tabular-nums">{fmt(subtotalAll)}</span>
                </div>
                {couvertValue > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Couvert artístico</span><span className="tabular-nums">{fmt(couvertValue)}</span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa de serviço ({serviceFeePercent}%)</span><span className="tabular-nums">{fmt(serviceFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                  <span>Total</span><span className="tabular-nums">{fmt(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Pedidos ativos */}
            {activeOrders.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Em andamento</h3>
                {activeOrders.map(order => {
                  const meta = STATUS_META[order.status] || STATUS_META.new;
                  const Icon = meta.icon;
                  return (
                    <div key={order.id} className="card-elevated p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-heading font-bold">Pedido #{order.number}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {order.customer_name && ` · ${order.customer_name}`}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {order.items.map(it => (
                          <div key={it.id} className="flex justify-between gap-3">
                            <span className="min-w-0">
                              <span className="font-medium">{it.qty}×</span> {it.name}
                              {Array.isArray(it.options) && it.options.length > 0 && (
                                <span className="block text-xs text-muted-foreground ml-5">
                                  {it.options.map((o: any) => o.name).join(', ')}
                                </span>
                              )}
                              {it.notes && <span className="block text-xs text-muted-foreground italic ml-5">→ {it.notes}</span>}
                            </span>
                            <span className="text-muted-foreground tabular-nums shrink-0">{fmt(Number(it.total_price))}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                        <Link to={`/pedido/${order.id}`} className="text-primary text-xs font-medium hover:underline">
                          Ver detalhes
                        </Link>
                        <span className="font-semibold tabular-nums">{fmt(Number(order.total))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pedidos entregues */}
            {completedOrders.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Já entregues</h3>
                {completedOrders.map(order => (
                  <div key={order.id} className="rounded-2xl border border-border bg-card/50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="font-medium">Pedido #{order.number}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums">{fmt(Number(order.total))}</span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-6">
                      {order.items.map(it => `${it.qty}× ${it.name}`).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action bar fixed */}
      <div className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-30">
        <div className="max-w-lg mx-auto px-4 py-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(`/${slug}/mesa/${tableNumber}`)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] shadow-sm"
          >
            <Plus className="h-4 w-4" /> Pedir mais
          </button>
          <button
            onClick={() => setShowCallConfirm(true)}
            disabled={callSent}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all active:scale-[0.98] border ${
              callSent
                ? 'bg-success/15 text-success border-success/30'
                : 'bg-background text-foreground border-border hover:bg-muted'
            }`}
          >
            <Bell className="h-4 w-4" /> {callSent ? 'Chamado!' : 'Chamar garçom'}
          </button>
          <button
            onClick={() => setShowBillConfirm(true)}
            disabled={billSent || orders.length === 0}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all active:scale-[0.98] border ${
              billSent
                ? 'bg-success/15 text-success border-success/30'
                : 'bg-background text-foreground border-border hover:bg-muted disabled:opacity-50'
            }`}
          >
            <HandCoins className="h-4 w-4" /> {billSent ? 'Pedida!' : 'Pedir a conta'}
          </button>
          <button
            onClick={() => setSplitOpen(true)}
            disabled={orders.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold border border-border bg-background hover:bg-muted transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Split className="h-4 w-4" /> Dividir
          </button>
        </div>
      </div>

      {/* Confirm dialogs */}
      {showCallConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCallConfirm(false)}>
          <div className="bg-card rounded-2xl p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <Bell className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-heading font-bold">Chamar garçom?</h3>
              <p className="text-sm text-muted-foreground">Vamos avisar o atendimento que você precisa de ajuda na Mesa {tableNumber}.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCallConfirm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">Cancelar</button>
              <button onClick={callWaiter} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Chamar</button>
            </div>
          </div>
        </div>
      )}

      {showBillConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowBillConfirm(false)}>
          <div className="bg-card rounded-2xl p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <HandCoins className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-heading font-bold">Pedir a conta?</h3>
              <p className="text-sm text-muted-foreground">Total atual da mesa: <strong>{fmt(grandTotal)}</strong>. O garçom levará a maquininha até você.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBillConfirm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">Cancelar</button>
              <button onClick={requestBill} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Pedir</button>
            </div>
          </div>
        </div>
      )}

      {splitOpen && orders.length > 0 && (
        <SplitBillDialog
          open={splitOpen}
          onOpenChange={setSplitOpen}
          order={{
            id: `table-${table.id}`,
            number: Number(tableNumber),
            total: grandTotal,
            order_items: orders.flatMap(o => o.items.map(it => ({
              id: it.id,
              name: it.name,
              qty: it.qty,
              total_price: Number(it.total_price),
            }))) as any,
          }}
        />
      )}
    </div>
  );
}
