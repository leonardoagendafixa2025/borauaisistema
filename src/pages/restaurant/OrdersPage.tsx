import { useState, useEffect } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useRestaurantOrders, useRestaurant, useRestaurantCategories, useRestaurantProducts } from '@/hooks/useRestaurantData';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Database } from '@/integrations/supabase/types';
import OrderTicket from '@/components/OrderTicket';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import SplitBillDialog from '@/components/SplitBillDialog';
import ManualOrderDialog from '@/components/ManualOrderDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Truck, Bike } from 'lucide-react';

type OrderStatus = Database['public']['Enums']['order_status'];

const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const statusConfig: Record<string, { label: string; class: string }> = {
  new: { label: 'Novo', class: 'bg-primary/10 text-primary ring-1 ring-primary/20' },
  accepted: { label: 'Aceito', class: 'bg-blue-500/10 text-blue-600' },
  preparing: { label: 'Preparando', class: 'bg-warning/10 text-warning' },
  ready: { label: 'Pronto', class: 'bg-success/10 text-success' },
  delivering: { label: 'Entregando', class: 'bg-accent/10 text-accent' },
  waiting_pickup: { label: 'Aguardando retirada', class: 'bg-accent/10 text-accent' },
  completed: { label: 'Concluído', class: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', class: 'bg-destructive/10 text-destructive' },
};

const typeLabels: Record<string, string> = { delivery: '🛵 Entrega', pickup: '🏪 Retirada', dine_in: '🍽️ QR Mesa', quick_sale: '🎉 Balada' };

const typeStyles: Record<string, { card: string; badge: string; accentBar: string }> = {
  delivery:   { card: 'border-l-4 border-l-accent',  badge: 'bg-accent/15 text-accent ring-1 ring-accent/30',          accentBar: 'bg-accent' },
  pickup:     { card: 'border-l-4 border-l-warning', badge: 'bg-warning/15 text-warning ring-1 ring-warning/30',       accentBar: 'bg-warning' },
  dine_in:    { card: 'border-l-4 border-l-primary', badge: 'bg-primary/15 text-primary ring-1 ring-primary/30 font-semibold', accentBar: 'bg-primary' },
  quick_sale: { card: 'border-l-4 border-l-primary', badge: 'bg-primary/15 text-primary ring-1 ring-primary/30 font-semibold', accentBar: 'bg-primary' },
};

const statusFlow: Record<string, OrderStatus> = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  waiting_pickup: 'completed',
};

const tabs: { key: string; label: string }[] = [
  { key: 'active', label: 'Ativos' },
  { key: 'completed', label: 'Concluídos' },
  { key: 'cancelled', label: 'Cancelados' },
  { key: 'all', label: 'Todos' },
];

function OrderDetailPanel({ order, updateStatus, setPrintOrder, restaurant, onSplitBill, onDispatch }: {
  order: any;
  updateStatus: (id: string, status: OrderStatus) => void;
  setPrintOrder: (o: any) => void;
  restaurant: any;
  onSplitBill: (o: any) => void;
  onDispatch: (o: any) => void;
}) {
  const s = statusConfig[order.status] || statusConfig.new;
  return (
    <div className="space-y-4 text-sm mt-4 lg:mt-0">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-lg">Pedido #{order.number}</h3>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.class}`}>{s.label}</span>
      </div>
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Cliente</p>
        <p className="font-medium">{order.customer_name}</p>
        {order.customer_phone && <p className="text-muted-foreground">{order.customer_phone}</p>}
        {order.address && <p className="text-muted-foreground">{order.address}</p>}
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Itens</p>
        {(order.order_items || []).map((item: any, i: number) => (
          <div key={i} className="py-1.5">
            <div className="flex justify-between">
              <span>{item.qty}x {item.name}</span>
              <span className="tabular-nums">{formatCurrency(Number(item.total_price))}</span>
            </div>
            {item.options && Array.isArray(item.options) && item.options.length > 0 && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {item.options.map((opt: any, oi: number) => (
                  <p key={oi} className="text-xs text-muted-foreground">+ {opt.name}{opt.price > 0 ? ` (${formatCurrency(opt.price)})` : ''}</p>
                ))}
              </div>
            )}
            {item.notes && <p className="text-xs text-muted-foreground ml-4 italic mt-0.5">→ {item.notes}</p>}
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3 space-y-1.5">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span><span className="tabular-nums">{formatCurrency(Number(order.subtotal))}</span>
        </div>
        {Number(order.delivery_fee) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Taxa de entrega</span><span className="tabular-nums">{formatCurrency(Number(order.delivery_fee))}</span>
          </div>
        )}
        {Number(order.discount) > 0 && (
          <div className="flex justify-between text-success">
            <span>Desconto</span><span className="tabular-nums">-{formatCurrency(Number(order.discount))}</span>
          </div>
        )}
        <div className="flex justify-between font-heading font-bold text-base pt-1">
          <span>Total</span><span className="tabular-nums">{formatCurrency(Number(order.total))}</span>
        </div>
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Pagamento</p>
        <p className="font-medium">{order.payment_method || '—'}</p>
      </div>
      {!['completed', 'cancelled'].includes(order.status) && (
        <div className="flex flex-col gap-2 pt-2">
          {/* Delivery: o botão de enviar ao entregador SÓ aparece após a cozinha marcar como Pronto */}
          {order.type === 'delivery' && order.status === 'ready' && (
            <button
              onClick={() => onDispatch(order)}
              className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/80 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              <Bike className="h-4 w-4" />
              {order.driver_id ? 'Trocar entregador' : 'Enviar para entregador'}
            </button>
          )}
          {order.type === 'delivery' && ['new', 'accepted', 'preparing'].includes(order.status) && (
            <div className="w-full rounded-lg bg-muted/50 text-muted-foreground px-3 py-2 text-xs text-center">
              🍳 Conclua o preparo para liberar o envio ao entregador
            </div>
          )}
          {order.type === 'delivery' && order.status === 'delivering' && order.driver_id && (
            <div className="w-full rounded-lg bg-success/10 text-success px-3 py-2 text-xs font-medium text-center">
              🛵 Em rota com entregador
            </div>
          )}
          <div className="flex gap-2">
            {statusFlow[order.status] && !(order.type === 'delivery' && order.status === 'delivering') && (
              <button
                onClick={() => updateStatus(order.id, statusFlow[order.status])}
                className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all"
              >
                {order.status === 'new' ? 'Aceitar' :
                 order.status === 'accepted' ? 'Preparar' :
                 order.status === 'preparing' ? 'Pronto' :
                 order.status === 'waiting_pickup' ? 'Concluir' : 'Avançar'}
              </button>
            )}
            {order.status === 'new' && (
              <button
                onClick={() => updateStatus(order.id, 'cancelled')}
                className="rounded-lg border border-destructive/30 px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 active:scale-[0.97] transition-all"
              >
                Recusar
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => setPrintOrder(order)}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          🖨️ Comanda
        </button>
        {order.type === 'dine_in' && (
          <button
            onClick={() => onSplitBill(order)}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            ✂️ Dividir conta
          </button>
        )}
        {order.customer_phone && (
          <a
            href={`https://wa.me/${order.customer_phone.replace(/\D/g, '').replace(/^0+/, '').replace(/^(?!55)/, '55')}?text=${encodeURIComponent(`Olá ${order.customer_name}! Atualização do seu pedido #${order.number} no ${restaurant?.name || 'restaurante'}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            📱 WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  useRealtimeOrders();
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: restaurant } = useRestaurant();
  const { data: orders = [], isLoading } = useRestaurantOrders();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('active');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dine_in' | 'delivery' | 'pickup' | 'quick_sale'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [splitOrder, setSplitOrder] = useState<any>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = orders.filter(o => {
    if (typeFilter !== 'all' && o.type !== typeFilter) return false;
    if (tab === 'active') return !['completed', 'cancelled'].includes(o.status);
    if (tab === 'completed') return o.status === 'completed';
    if (tab === 'cancelled') return o.status === 'cancelled';
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedFiltered = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Counters per type for the active tab (visual badges on filter chips)
  const typeCounts = orders.reduce((acc: Record<string, number>, o) => {
    if (!['completed', 'cancelled'].includes(o.status)) {
      acc[o.type] = (acc[o.type] || 0) + 1;
    }
    return acc;
  }, {});

  const selectedOrder = orders.find(o => o.id === selected);

  const { data: categories = [] } = useRestaurantCategories();
  const { data: products = [] } = useRestaurantProducts();

  // Build skip_kitchen detection
  const skipKitchenCatIds = new Set(categories.filter((c: any) => c.skip_kitchen).map(c => c.id));
  const isSkipKitchenOrder = (order: any) => {
    const items = order.order_items || [];
    if (items.length === 0) return false;
    return items.every((item: any) => {
      const product = products.find((p: any) => p.id === item.product_id);
      return product && skipKitchenCatIds.has(product.category_id);
    });
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    let finalStatus = newStatus;
    // If accepting a drink-only order, skip straight to ready
    if (order && newStatus === 'accepted' && isSkipKitchenOrder(order)) {
      finalStatus = 'ready';
      toast.success('Pedido de bebida → Pronto!');
    }
    // Differentiate ready → pickup vs delivery
    if (finalStatus === 'ready' && order) {
      if (order.type === 'pickup') finalStatus = 'waiting_pickup';
    }
    // Delivery is only completed by the driver app after handoff
    if (order && order.type === 'delivery' && finalStatus === 'completed') {
      toast.error('Delivery só é concluído pelo app do entregador.');
      return;
    }
    await supabase.from('orders').update({ status: finalStatus }).eq('id', orderId);
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
  };

  // Load drivers when dispatch dialog opens
  useEffect(() => {
    if (!dispatchOrder || !restaurantId) return;
    setLoadingDrivers(true);
    supabase
      .from('delivery_drivers')
      .select('id, name, vehicle, phone, status, last_location_at')
      .eq('restaurant_id', restaurantId)
      .order('status', { ascending: true })
      .order('name')
      .then(({ data }) => {
        setDrivers(data || []);
        setLoadingDrivers(false);
      });
  }, [dispatchOrder, restaurantId]);

  const handleAssignDriver = async (driverId: string) => {
    if (!dispatchOrder) return;
    if (dispatchOrder.type !== 'delivery' || dispatchOrder.status !== 'ready') {
      toast.error('Só é possível enviar para entregador depois que o pedido estiver pronto.');
      setDispatchOrder(null);
      return;
    }
    const { error } = await supabase
      .from('orders')
      .update({ driver_id: driverId, status: 'delivering' })
      .eq('id', dispatchOrder.id);
    if (error) { toast.error('Erro ao despachar: ' + error.message); return; }
    // Mark driver as busy
    await supabase.from('delivery_drivers').update({ status: 'busy' }).eq('id', driverId);
    toast.success('Pedido enviado para o entregador! 🛵');
    setDispatchOrder(null);
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
  };

  return (
    <RestaurantLayout>
      <div className="space-y-4">
        <ScrollReveal>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight">Pedidos</h1>
              <p className="text-sm text-muted-foreground mt-1">Acompanhe e gerencie todos os pedidos.</p>
            </div>
            <button
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30 hover:shadow-md hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-[0.97] transition-all"
            >
              <Plus className="h-4 w-4" /> Novo pedido manual
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <div className="flex gap-1 rounded-2xl bg-muted p-1 overflow-x-auto no-scrollbar ring-1 ring-border/60">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 shrink-0 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all ${
                  tab === t.key ? 'bg-card shadow-sm text-foreground ring-1 ring-border/60' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {([
              { key: 'all',      label: 'Todos os tipos', dot: 'bg-muted-foreground' },
              { key: 'dine_in',  label: `🍽️ QR Mesa${typeCounts.dine_in ? ` (${typeCounts.dine_in})` : ''}`, dot: 'bg-primary' },
              { key: 'delivery', label: `🛵 Delivery${typeCounts.delivery ? ` (${typeCounts.delivery})` : ''}`, dot: 'bg-accent' },
              { key: 'pickup',   label: `🏪 Retirada${typeCounts.pickup ? ` (${typeCounts.pickup})` : ''}`, dot: 'bg-warning' },
              { key: 'quick_sale', label: `🎉 Balada${typeCounts.quick_sale ? ` (${typeCounts.quick_sale})` : ''}`, dot: 'bg-primary' },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  typeFilter === f.key
                    ? 'bg-foreground text-background border-foreground shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
                {f.label}
              </button>
            ))}
          </div>
        </ScrollReveal>


        {isLoading ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="grid lg:grid-cols-[1fr,400px] gap-4">
            <ScrollReveal delay={120}>
              <div className="space-y-3">
                {filtered.length === 0 && (
                  <div className="card-elevated p-12 text-center text-muted-foreground">
                    Nenhum pedido encontrado
                  </div>
                )}
                {paginatedFiltered.map(order => {
                  const s = statusConfig[order.status] || statusConfig.new;
                  const ts = typeStyles[order.type] || typeStyles.delivery;
                  const tableInfo = (order as any).restaurant_tables;
                  const tableLabel = tableInfo?.label || (tableInfo?.number ? `Mesa ${tableInfo.number}` : null);
                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelected(order.id)}
                      className={`w-full text-left card-elevated p-3 sm:p-4 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${ts.card} ${
                        selected === order.id ? 'ring-2 ring-primary shadow-md' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${ts.badge}`}>
                              {typeLabels[order.type] || order.type}
                              {order.type === 'dine_in' && tableLabel && ` · ${tableLabel}`}
                            </span>
                            <span className="font-heading font-black text-sm sm:text-base tracking-tight">#{order.number}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium ${s.class}`}>{s.label}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                            {order.customer_name} · {(order.order_items || []).length} {(order.order_items || []).length === 1 ? 'item' : 'itens'}
                          </p>
                          {/* Origin hint per order type */}
                          {order.type === 'dine_in' && tableLabel && (
                            <p className="text-xs mt-1 inline-flex items-center gap-1 text-primary font-medium">
                              📍 {tableLabel}
                            </p>
                          )}
                          {order.type === 'delivery' && order.address && (
                            <p className="text-xs mt-1 inline-flex items-start gap-1 text-accent">
                              <span>🛵</span>
                              <span className="truncate">{order.address}</span>
                            </p>
                          )}
                          {order.type === 'pickup' && (
                            <p className="text-xs mt-1 inline-flex items-center gap-1 text-warning font-medium">
                              🏪 Retirar às {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-heading font-black text-sm sm:text-base tabular-nums tracking-tight">{formatCurrency(Number(order.total))}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                            {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                      </div>
                    </button>
                  );
                })}
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors">← Anterior</button>
                    <span className="text-xs text-muted-foreground">{page + 1} de {totalPages}</span>
                    <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors">Próximo →</button>
                  </div>
                )}
              </div>
            </ScrollReveal>

            {/* Desktop detail panel */}
            <div className="hidden lg:block">
              {selectedOrder ? (
                <div className="card-elevated p-5 sticky top-4 animate-fade-in">
                  <OrderDetailPanel
                    order={selectedOrder}
                    updateStatus={updateStatus}
                    setPrintOrder={setPrintOrder}
                    restaurant={restaurant}
                    onSplitBill={setSplitOrder}
                    onDispatch={setDispatchOrder}
                  />
                </div>
              ) : (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <p>Selecione um pedido para ver os detalhes</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile detail sheet */}
        {isMobile && (
          <Sheet open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelected(null); }}>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Pedido #{selectedOrder?.number}</SheetTitle></SheetHeader>
              {selectedOrder && (
                <OrderDetailPanel
                  order={selectedOrder}
                  updateStatus={updateStatus}
                  setPrintOrder={setPrintOrder}
                  restaurant={restaurant}
                  onSplitBill={setSplitOrder}
                  onDispatch={setDispatchOrder}
                />
              )}
            </SheetContent>
          </Sheet>
        )}

        {printOrder && (
          <OrderTicket
            order={printOrder}
            restaurantName={restaurant?.name}
            onClose={() => setPrintOrder(null)}
          />
        )}

        <SplitBillDialog
          open={!!splitOrder}
          onOpenChange={(open) => { if (!open) setSplitOrder(null); }}
          order={splitOrder}
        />

        <ManualOrderDialog open={manualOpen} onOpenChange={setManualOpen} />

        {/* Dispatch driver dialog */}
        <Dialog open={!!dispatchOrder} onOpenChange={(open) => { if (!open) setDispatchOrder(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Enviar pedido #{dispatchOrder?.number}
              </DialogTitle>
              <DialogDescription>
                Escolha o entregador. O pedido vai aparecer no app dele imediatamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loadingDrivers && (
                <p className="text-sm text-muted-foreground py-6 text-center">Carregando entregadores...</p>
              )}
              {!loadingDrivers && drivers.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum entregador cadastrado.<br />
                  <a href="/restaurant/delivery-drivers" className="text-primary underline mt-2 inline-block">Cadastrar agora →</a>
                </div>
              )}
              {!loadingDrivers && drivers.map((d) => {
                const recentGps = d.last_location_at && (Date.now() - new Date(d.last_location_at).getTime()) < 2 * 60 * 1000;
                const isCurrent = dispatchOrder?.driver_id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleAssignDriver(d.id)}
                    disabled={isCurrent}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      isCurrent ? 'border-primary bg-primary/5 cursor-default' : 'border-border hover:border-primary hover:bg-muted/50 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        d.status === 'available' ? 'bg-success/15 text-success' :
                        d.status === 'busy' ? 'bg-warning/15 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        <Bike className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          {d.name}
                          {isCurrent && <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">ATUAL</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.vehicle} · {d.status === 'available' ? 'Disponível' : d.status === 'busy' ? 'Ocupado' : 'Offline'}
                          {recentGps && ' · 📍 GPS ativo'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RestaurantLayout>
  );
}
