import { useState, useEffect, useRef, useMemo } from 'react';
import { ShoppingBag, DollarSign, TrendingUp, Clock, Bell, Truck, Store, UtensilsCrossed, Lock, Printer, Zap, CheckCircle, Phone, Target, Users, Package, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderTicket from '@/components/OrderTicket';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import {
  useRestaurantOrders,
  useRestaurantWaiterCalls,
  useRestaurantCategories,
  useRestaurantProducts,
  useRestaurantSettings,
  useRestaurant,
  useRestaurantTables,
} from '@/hooks/useRestaurantData';
import { useYesterdayOrders } from '@/hooks/useYesterdayOrders';
import { useRealtimeOrders, useRealtimeWaiterCalls } from '@/hooks/useRealtimeOrders';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Database } from '@/integrations/supabase/types';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import DeliverySlaAlerts from '@/components/DeliverySlaAlerts';
import DashboardHero from '@/components/dashboard/DashboardHero';
import MetricCardPremium from '@/components/dashboard/MetricCardPremium';
import HourlyPulse from '@/components/dashboard/HourlyPulse';
import ModalitySplit from '@/components/dashboard/ModalitySplit';
import TopProductsToday from '@/components/dashboard/TopProductsToday';
import LiveActivityFeed from '@/components/dashboard/LiveActivityFeed';
import OrderCardPriority from '@/components/dashboard/OrderCardPriority';
import OfflineQueueBanner from '@/components/dashboard/OfflineQueueBanner';
import TelegramLinkBanner from '@/components/dashboard/TelegramLinkBanner';
import OnboardingTour from '@/components/dashboard/OnboardingTour';
import LiveOpsGrid from '@/components/dashboard/LiveOpsGrid';
import { useDashboardOffline } from '@/hooks/useDashboardOffline';
import OrdersFilterBar, { type OrdersFilterValue } from '@/components/dashboard/OrdersFilterBar';

type OrderStatus = Database['public']['Enums']['order_status'];

const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const typeLabels: Record<string, string> = { delivery: '🛵 Entrega', pickup: '🏪 Retirada', dine_in: '🍽️ Local', quick_sale: '⚡ Balada' };

const statusFlow: Record<string, OrderStatus> = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
};

const statusActionLabel: Record<string, string> = {
  new: 'Aceitar',
  accepted: 'Preparar',
  preparing: 'Pronto!',
  ready: 'Entregar',
};

const callTypeConfig: Record<string, { label: string; icon: string; class: string }> = {
  call_waiter: { label: 'Garçom', icon: '🔔', class: 'bg-warning/10 text-warning border-warning/20' },
  request_bill: { label: 'Conta', icon: '💰', class: 'bg-primary/10 text-primary border-primary/20' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

/** Compute hourly buckets for sparkline (revenue or count). */
function buildHourlyBuckets(orders: any[], field: 'count' | 'revenue', currentHour: number): number[] {
  const arr = Array(currentHour + 1).fill(0);
  orders.forEach(o => {
    if (o.status === 'cancelled') return;
    const h = new Date(o.created_at).getHours();
    if (h <= currentHour) {
      arr[h] += field === 'count' ? 1 : Number(o.total || 0);
    }
  });
  return arr;
}

const DAILY_REVENUE_GOAL_KEY = 'meubar.dashboard.daily_goal';

export default function RestaurantDashboard() {
  useRealtimeOrders();
  useRealtimeWaiterCalls();
  const { status: liveStatus, lastEventAt, refresh: refreshLive } = useRealtimeDashboard();

  // Soft tick every 15s so urgency timers, "time ago" labels and elapsed
  // counters re-render without waiting for new realtime events.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: ordersFresh = [], isLoading } = useRestaurantOrders(undefined, 'today');
  const { data: yesterdayOrders = [] } = useYesterdayOrders();
  const { data: waiterCallsFresh = [] } = useRestaurantWaiterCalls();
  const { data: categories = [] } = useRestaurantCategories();
  const { data: products = [] } = useRestaurantProducts();
  const { data: settingsFresh } = useRestaurantSettings();
  const { data: restaurant } = useRestaurant();
  const plan = usePlanFeatures();

  // Offline mode (queue + 24h snapshot)
  const offline = useDashboardOffline();

  // Persist last-known data to IndexedDB so the page survives a hard refresh offline.
  useEffect(() => { if (offline.online && ordersFresh.length) offline.snapshot('orders', ordersFresh); }, [ordersFresh, offline]);
  useEffect(() => { if (offline.online && waiterCallsFresh.length) offline.snapshot('waiter_calls', waiterCallsFresh); }, [waiterCallsFresh, offline]);
  useEffect(() => { if (offline.online && settingsFresh) offline.snapshot('restaurant_settings', [settingsFresh]); }, [settingsFresh, offline]);
  useEffect(() => { if (offline.online && restaurant) offline.snapshot('restaurants', [restaurant]); }, [restaurant, offline]);

  // Hydrate from snapshot when offline + queries are empty (post-refresh scenario)
  const [cachedOrders, setCachedOrders] = useState<any[]>([]);
  const [cachedCalls, setCachedCalls] = useState<any[]>([]);
  useEffect(() => {
    if (!offline.online && ordersFresh.length === 0) {
      offline.getCachedSync('orders').then(setCachedOrders);
    }
    if (!offline.online && waiterCallsFresh.length === 0) {
      offline.getCachedSync('waiter_calls').then(setCachedCalls);
    }
  }, [offline, ordersFresh.length, waiterCallsFresh.length]);

  // Final views: prefer fresh, fallback to cache, then overlay pending optimistic patches.
  const orders = useMemo(
    () => offline.overlayPending('orders', ordersFresh.length ? ordersFresh : cachedOrders),
    [ordersFresh, cachedOrders, offline],
  );
  const waiterCalls = useMemo(
    () => offline.overlayPending('waiter_calls', waiterCallsFresh.length ? waiterCallsFresh : cachedCalls),
    [waiterCallsFresh, cachedCalls, offline],
  );
  const settings = useMemo(() => {
    if (!settingsFresh) return settingsFresh;
    const patched = offline.overlayPending('restaurant_settings', [settingsFresh as any]);
    return patched[0] as typeof settingsFresh;
  }, [settingsFresh, offline]);
  const [activeTab, setActiveTab] = useState('active');
  const [reprintOrder, setReprintOrder] = useState<any>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem(DAILY_REVENUE_GOAL_KEY) || 0);
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const prevNewCountRef = useRef<number>(0);

  // Sound alert for new orders
  const newOrderCount = orders.filter(o => o.status === 'new').length;
  useEffect(() => {
    if (newOrderCount > prevNewCountRef.current && prevNewCountRef.current >= 0) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
        setTimeout(() => ctx.close(), 600);
      } catch {}
    }
    prevNewCountRef.current = newOrderCount;
  }, [newOrderCount]);

  const toggleModality = async (
    field: 'delivery_enabled' | 'pickup_enabled' | 'dine_in_enabled' | 'quick_sale_enabled',
    current: boolean,
  ) => {
    if (!settings) return;
    const labelMap: Record<typeof field, string> = {
      delivery_enabled: 'Delivery',
      pickup_enabled: 'Retirada',
      dine_in_enabled: 'Mesa',
      quick_sale_enabled: 'Modo Balada',
    } as any;
    const res = await offline.enqueue({
      table: 'restaurant_settings',
      rowId: settings.id,
      patch: { [field]: !current },
      label: `${labelMap[field]} → ${!current ? 'ligado' : 'desligado'}`,
    });
    if (res.error) { toast.error(`Erro: ${res.error}`); return; }
    if (res.queued) toast.info(`Modalidade salva offline — sincroniza ao reconectar`);
    else toast.success(`Modalidade ${!current ? 'ativada' : 'desativada'}`);
    queryClient.invalidateQueries({ queryKey: ['restaurant_settings', restaurantId] });
  };

  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const completedToday = orders.filter(o => o.status === 'completed');
  const revenueToday = completedToday.reduce((sum, o) => sum + Number(o.total), 0);
  const totalForAvg = completedToday.length || 1;
  const pendingCalls = waiterCalls.filter(c => c.status === 'pending');

  // Yesterday comparisons (same hour cutoff)
  const nowHour = new Date().getHours();
  const ydayUntilNow = useMemo(() => yesterdayOrders.filter(o => {
    const h = new Date(o.created_at).getHours();
    return h <= nowHour && o.status !== 'cancelled';
  }), [yesterdayOrders, nowHour]);
  const ydayRevenue = ydayUntilNow.reduce((s, o) => s + Number(o.total || 0), 0);
  const ydayCount = ydayUntilNow.length;

  const computeDelta = (today: number, yesterday: number) => {
    if (yesterday === 0) return today === 0 ? 0 : 100;
    return ((today - yesterday) / yesterday) * 100;
  };

  const ordersDelta = computeDelta(orders.length, ydayCount);
  const revenueDelta = computeDelta(revenueToday, ydayRevenue);
  const ticketToday = revenueToday / totalForAvg;
  const ydayTicket = ydayUntilNow.length > 0 ? ydayRevenue / ydayUntilNow.length : 0;
  const ticketDelta = computeDelta(ticketToday, ydayTicket);

  // Sparklines
  const revenueSpark = buildHourlyBuckets(orders, 'revenue', nowHour);
  const countSpark = buildHourlyBuckets(orders, 'count', nowHour);

  // Skip kitchen logic
  const skipKitchenCatIds = new Set(categories.filter(c => c.skip_kitchen).map(c => c.id));
  const productCatMap = new Map(products.map(p => [p.id, p.category_id]));

  const isSkipKitchenOrder = (order: any) => {
    const items = order.order_items || [];
    if (items.length === 0) return false;
    return items.every((item: any) => {
      const catId = productCatMap.get(item.product_id);
      return catId && skipKitchenCatIds.has(catId);
    });
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, order?: any) => {
    let finalStatus = newStatus;
    if (newStatus === 'accepted' && order && isSkipKitchenOrder(order)) {
      finalStatus = 'ready';
    }
    if (finalStatus === 'ready' && order) {
      if (order.type === 'pickup') finalStatus = 'waiting_pickup';
    }
    if (order?.type === 'delivery' && finalStatus === 'delivering') {
      toast.error('Envie o pedido para um entregador pela tela de Pedidos.');
      return;
    }
    const followTable = (order?.type === 'dine_in' && order?.table_id && (newStatus === 'accepted' || finalStatus === 'accepted'))
      ? { table: 'restaurant_tables', rowId: order.table_id, patch: { status: 'occupied' } }
      : null;
    const res = await offline.enqueue({
      table: 'orders',
      rowId: orderId,
      patch: { status: finalStatus },
      follow: followTable,
      label: `Pedido #${order?.number ?? orderId.slice(0, 6)} → ${finalStatus}`,
    });
    if (res.error) { toast.error(`Erro: ${res.error}`); return; }
    if (res.queued) toast.info('Salvo offline — envia ao reconectar');
    else toast.success('Pedido atualizado');
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
    if (followTable) queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
  };

  const completeOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order?.type === 'delivery') {
      toast.error('Delivery só é concluído pelo app do entregador.');
      return;
    }
    const followTable = (order?.type === 'dine_in' && order?.table_id)
      ? { table: 'restaurant_tables', rowId: order.table_id, patch: { status: 'available' } }
      : null;
    const res = await offline.enqueue({
      table: 'orders',
      rowId: orderId,
      patch: { status: 'completed' as OrderStatus },
      follow: followTable,
      label: `Concluir #${order?.number ?? orderId.slice(0, 6)}`,
    });
    if (res.error) { toast.error(`Erro: ${res.error}`); return; }

    // Side effects (financial + CRM) only run online — they require INSERTs that we
    // don't queue. When replayed from offline, the order will appear as completed
    // and the operator can settle financials later from the orders/cashier pages.
    if (!res.queued && order && restaurantId) {
      await supabase.from('financial_transactions').insert({
        restaurant_id: restaurantId,
        order_id: orderId,
        type: 'revenue',
        amount: Number(order.total),
        description: `Pedido #${order.number} - ${order.customer_name}`,
      });

      if (order.customer_id) {
        const { data: customer } = await supabase.from('customers').select('total_orders, total_spent').eq('id', order.customer_id).maybeSingle();
        if (customer) {
          await supabase.from('customers').update({
            total_orders: (customer.total_orders || 0) + 1,
            total_spent: Number(customer.total_spent || 0) + Number(order.total),
          }).eq('id', order.customer_id);
        }
      }
    }

    if (res.queued) toast.info('Conclusão salva offline');
    else toast.success('Pedido concluído!');
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
    if (followTable) queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Tem certeza que deseja cancelar este pedido?')) return;
    const order = orders.find(o => o.id === orderId);
    const followTable = (order?.type === 'dine_in' && order?.table_id)
      ? { table: 'restaurant_tables', rowId: order.table_id, patch: { status: 'available' } }
      : null;
    const res = await offline.enqueue({
      table: 'orders',
      rowId: orderId,
      patch: { status: 'cancelled' as OrderStatus },
      follow: followTable,
      label: `Cancelar #${order?.number ?? orderId.slice(0, 6)}`,
    });
    if (res.error) { toast.error(`Erro: ${res.error}`); return; }
    if (res.queued) toast.info('Cancelamento salvo offline');
    else toast.success('Pedido cancelado');
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
    if (followTable) queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
  };

  const updateCallStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'completed') patch.completed_at = new Date().toISOString();
    const res = await offline.enqueue({
      table: 'waiter_calls',
      rowId: id,
      patch,
      label: `Chamada → ${status === 'completed' ? 'concluída' : 'atendida'}`,
    });
    if (res.error) { toast.error(`Erro: ${res.error}`); return; }
    if (res.queued) toast.info('Salvo offline');
    else toast.success(status === 'completed' ? 'Chamada concluída' : 'Chamada atendida');
    queryClient.invalidateQueries({ queryKey: ['waiter_calls', restaurantId] });
  };

  const saveGoal = (val: number) => {
    setDailyGoal(val);
    localStorage.setItem(DAILY_REVENUE_GOAL_KEY, String(val));
    setEditingGoal(false);
    if (val > 0) toast.success('Meta diária definida!');
  };

  // ===== Filters & search =====
  const { data: tables = [] } = useRestaurantTables();
  const [filters, setFilters] = useState<OrdersFilterValue>({
    search: '',
    type: 'all',
    tableId: 'all',
    wait: 'all',
  });

  const matchesFilters = (o: any) => {
    // Search: order number, customer name, phone
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const numStr = String(o.number || '');
      const nameStr = (o.customer_name || '').toLowerCase();
      const phoneStr = (o.customer_phone || '').replace(/\D/g, '');
      const qDigits = q.replace(/\D/g, '');
      const matched =
        numStr.includes(q.replace('#', '')) ||
        nameStr.includes(q) ||
        (qDigits && phoneStr.includes(qDigits));
      if (!matched) return false;
    }
    if (filters.type !== 'all' && o.type !== filters.type) return false;
    if (filters.tableId !== 'all' && o.table_id !== filters.tableId) return false;
    if (filters.wait !== 'all') {
      const waitMin = (Date.now() - new Date(o.created_at).getTime()) / 60000;
      if (filters.wait === 'lt5' && waitMin >= 5) return false;
      if (filters.wait === '5to15' && (waitMin < 5 || waitMin > 15)) return false;
      if (filters.wait === 'gt15' && waitMin <= 15) return false;
    }
    return true;
  };

  const filteredActive = activeOrders.filter(matchesFilters);
  const filteredCompleted = completedToday.filter(matchesFilters);

  const newOrders = filteredActive.filter(o => o.status === 'new');
  const inProgressOrders = filteredActive.filter(o => ['accepted', 'preparing'].includes(o.status));
  const readyOrders = filteredActive.filter(o => ['ready', 'delivering', 'waiting_pickup'].includes(o.status));

  const goalProgress = dailyGoal > 0 ? (revenueToday / dailyGoal) * 100 : undefined;

  return (
    <RestaurantLayout>
      <div className="space-y-4">
        {/* HERO */}
        <DashboardHero
          restaurantName={restaurant?.name}
          isOpen={restaurant?.is_open ?? false}
          activeOrdersCount={activeOrders.length}
          pendingCallsCount={pendingCalls.length}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode(f => !f)}
          liveStatus={liveStatus}
          lastEventAt={lastEventAt}
          onRefresh={refreshLive}
        />

        {/* SLA Delivery Alerts */}
        <OfflineQueueBanner online={offline.online} pendingActions={offline.pendingActions} />
        <OnboardingTour />
        <TelegramLinkBanner slug={(restaurant as any)?.slug} />
        <DeliverySlaAlerts />

        {!focusMode && (
          <>
            {/* METRICS ROW — premium */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <MetricCardPremium
                label="Pedidos hoje"
                value={orders.length}
                icon={ShoppingBag}
                spark={countSpark}
                delta={ordersDelta}
                accent="primary"
              />
              <MetricCardPremium
                label="Faturamento"
                value={formatCurrency(revenueToday)}
                icon={DollarSign}
                spark={revenueSpark}
                delta={revenueDelta}
                progress={goalProgress}
                progressLabel={dailyGoal > 0 ? `Meta ${formatCurrency(dailyGoal)}` : undefined}
                accent="success"
              />
              <MetricCardPremium
                label="Ticket médio"
                value={formatCurrency(ticketToday)}
                icon={TrendingUp}
                delta={ticketDelta}
                accent="accent"
              />
              <MetricCardPremium
                label="Em andamento"
                value={activeOrders.length}
                icon={Clock}
                accent={activeOrders.length > 5 ? 'warning' : 'primary'}
              />
              <MetricCardPremium
                label="Chamadas"
                value={pendingCalls.length}
                icon={Bell}
                accent={pendingCalls.length > 0 ? 'destructive' : 'primary'}
              />
            </div>

            {/* LIVE OPS GRID — operação ao vivo agrupada por domínio */}
            <LiveOpsGrid />

            {/* PULSE + SPLIT + GOAL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2">
                <HourlyPulse orders={orders} />
              </div>
              <ModalitySplit orders={orders} />
            </div>

            {/* QUICK ACTIONS DOCK */}
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="font-heading font-black text-sm tracking-tight">Atalhos rápidos</h3>
                </div>
                {!editingGoal && (
                  <button
                    onClick={() => setEditingGoal(true)}
                    className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors"
                  >
                    {dailyGoal > 0 ? `Meta: ${formatCurrency(dailyGoal)} ✏️` : '+ Definir meta diária'}
                  </button>
                )}
                {editingGoal && (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      saveGoal(Number(fd.get('goal') || 0));
                    }}
                    className="flex items-center gap-1"
                  >
                    <span className="text-[10px] text-muted-foreground">R$</span>
                    <input
                      name="goal"
                      type="number"
                      autoFocus
                      defaultValue={dailyGoal}
                      className="w-24 h-7 rounded-md border border-border px-2 text-xs font-bold tabular-nums bg-background"
                    />
                    <button type="submit" className="text-[10px] font-bold text-primary hover:underline">Salvar</button>
                    <button type="button" onClick={() => setEditingGoal(false)} className="text-[10px] text-muted-foreground hover:underline">×</button>
                  </form>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { to: '/restaurant/orders', icon: ClipboardList, label: 'Pedidos' },
                  { to: '/restaurant/menu', icon: Package, label: 'Cardápio' },
                  { to: '/restaurant/tables', icon: UtensilsCrossed, label: 'Mesas' },
                  { to: '/restaurant/customers', icon: Users, label: 'Clientes' },
                  { to: '/restaurant/cashier', icon: DollarSign, label: 'Caixa' },
                  { to: '/restaurant/reports', icon: TrendingUp, label: 'Relatórios' },
                ].map(a => (
                  <Link
                    key={a.to}
                    to={a.to}
                    className="group flex flex-col items-center justify-center gap-1.5 rounded-xl ring-1 ring-border/60 bg-muted/20 hover:bg-primary/5 hover:ring-primary/30 px-2 py-3 transition-all hover:-translate-y-0.5"
                  >
                    <a.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* MODALITY TOGGLES */}
            <div className="card-elevated p-4">
              <h3 className="font-heading font-black text-sm tracking-tight mb-3 uppercase text-muted-foreground">
                Modalidades de atendimento
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { field: 'delivery_enabled' as const, label: 'Delivery', icon: Truck, enabled: settings?.delivery_enabled ?? false, locked: false },
                  { field: 'pickup_enabled' as const, label: 'Retirada', icon: Store, enabled: settings?.pickup_enabled ?? false, locked: false },
                  { field: 'dine_in_enabled' as const, label: 'Mesa (QR Code)', icon: UtensilsCrossed, enabled: settings?.dine_in_enabled ?? false, locked: !plan.loading && !plan.hasQrCode },
                  { field: 'quick_sale_enabled' as const, label: 'Modo Balada', icon: Zap, enabled: settings?.quick_sale_enabled ?? false, locked: !plan.loading && !plan.hasQuickSale },
                ].map(mod => (
                  <div key={mod.field} className={`group flex items-center gap-3 rounded-2xl ring-1 px-4 py-2.5 transition-all ${
                    mod.locked ? 'ring-border bg-muted/30 opacity-50' :
                    mod.enabled
                      ? 'ring-primary/30 bg-gradient-to-br from-primary/10 to-primary/[0.02] shadow-sm shadow-primary/10'
                      : 'ring-border bg-muted/20 hover:ring-border'
                  }`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      mod.locked ? 'bg-muted text-muted-foreground' :
                      mod.enabled ? 'bg-primary/15 text-primary ring-1 ring-primary/20' : 'bg-muted text-muted-foreground'
                    }`}>
                      <mod.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">{mod.label}</span>
                    {mod.locked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Switch checked={mod.enabled} onCheckedChange={() => toggleModality(mod.field, mod.enabled)} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* WAITER CALLS ALERT BAR */}
            {pendingCalls.length > 0 && (
              <ScrollReveal>
                <div className="card-elevated border-l-4 border-l-warning p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="h-5 w-5 text-warning animate-pulse" />
                    <h3 className="font-heading font-semibold text-sm">Chamadas pendentes ({pendingCalls.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {pendingCalls.map(call => {
                      const cfg = callTypeConfig[call.type] || callTypeConfig.call_waiter;
                      const tableInfo = (call as any).restaurant_tables;
                      const tableName = tableInfo?.label || `Mesa ${tableInfo?.number}`;
                      return (
                        <div key={call.id} className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${cfg.class}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{cfg.icon}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{tableName}</p>
                              <p className="text-xs opacity-70">{cfg.label} · {timeAgo(call.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => updateCallStatus(call.id, 'acknowledged')} className="px-2 py-1 text-xs font-medium rounded-md bg-background/80 hover:bg-background transition-colors">
                              Atender
                            </button>
                            <button onClick={() => updateCallStatus(call.id, 'completed')} className="px-2 py-1 text-xs font-medium rounded-md bg-background/80 hover:bg-background transition-colors">
                              ✓
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollReveal>
            )}
          </>
        )}

        {/* MAIN ORDERS AREA + SIDE PANELS */}
        <div className={`grid gap-3 ${focusMode ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-3'}`}>
          <div className={focusMode ? '' : 'xl:col-span-2'}>
            {isLoading ? (
              <div className="card-elevated p-12 text-center text-muted-foreground">Carregando...</div>
            ) : (
              <div className="space-y-3">
                <OrdersFilterBar
                  value={filters}
                  onChange={setFilters}
                  tables={tables as any}
                  resultCount={activeTab === 'completed' ? filteredCompleted.length : filteredActive.length}
                  totalCount={activeTab === 'completed' ? completedToday.length : activeOrders.length}
                />
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
                <TabsList className="w-full grid grid-cols-4 h-auto p-1 rounded-2xl">
                  <TabsTrigger value="active" className="text-xs sm:text-sm gap-1.5 rounded-xl py-2.5 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive data-[state=active]:shadow-none data-[state=active]:font-black">
                    <span className="h-2 w-2 rounded-full bg-destructive inline-block animate-pulse" aria-hidden />
                    Novos {newOrders.length > 0 && <span className="ml-1 bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums">{newOrders.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="progress" className="text-xs sm:text-sm gap-1.5 rounded-xl py-2.5 data-[state=active]:bg-warning/10 data-[state=active]:text-warning data-[state=active]:shadow-none data-[state=active]:font-black">
                    <span className="h-2 w-2 rounded-full bg-warning inline-block" aria-hidden />
                    Preparo {inProgressOrders.length > 0 && <span className="ml-1 bg-warning text-warning-foreground rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums">{inProgressOrders.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="ready" className="text-xs sm:text-sm gap-1.5 rounded-xl py-2.5 data-[state=active]:bg-success/10 data-[state=active]:text-success data-[state=active]:shadow-none data-[state=active]:font-black">
                    <span className="h-2 w-2 rounded-full bg-success inline-block" aria-hidden />
                    Prontos {readyOrders.length > 0 && <span className="ml-1 bg-success text-success-foreground rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums">{readyOrders.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs sm:text-sm gap-1.5 rounded-xl py-2.5 data-[state=active]:font-black">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Feitos
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-2">
                  {newOrders.length === 0 ? (
                    <div className="card-elevated p-8 text-center text-muted-foreground text-sm">Nenhum pedido novo 🎉</div>
                  ) : (
                    newOrders.map(order => (
                      <OrderCardPriority key={order.id} order={order} onAction={() => updateOrderStatus(order.id, 'accepted', order)} actionLabel="Aceitar" onComplete={completeOrder} onCancel={cancelOrder} />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="progress" className="space-y-2">
                  {inProgressOrders.length === 0 ? (
                    <div className="card-elevated p-8 text-center text-muted-foreground text-sm">Nenhum pedido em preparo</div>
                  ) : (
                    inProgressOrders.map(order => {
                      const next = statusFlow[order.status];
                      const label = statusActionLabel[order.status] || 'Avançar';
                      return (
                        <OrderCardPriority key={order.id} order={order} onAction={next ? () => updateOrderStatus(order.id, next, order) : undefined} actionLabel={label} onComplete={completeOrder} onCancel={cancelOrder} />
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="ready" className="space-y-2">
                  {readyOrders.length === 0 ? (
                    <div className="card-elevated p-8 text-center text-muted-foreground text-sm">Nenhum pedido pronto</div>
                  ) : (
                    readyOrders.map(order => (
                      <OrderCardPriority key={order.id} order={order} onAction={order.type === 'delivery' ? undefined : () => completeOrder(order.id)} actionLabel="Concluir" onComplete={completeOrder} onCancel={cancelOrder} showDeliveryAction={order.type === 'delivery' && order.status === 'ready'} />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-2">
                  {filteredCompleted.length === 0 ? (
                    <div className="card-elevated p-8 text-center text-muted-foreground text-sm">Nenhum pedido concluído</div>
                  ) : (
                    <div className="card-elevated divide-y divide-border/60">
                      {filteredCompleted.slice(0, 20).map(order => (
                        <div key={order.id} className="px-4 py-3 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 text-success shrink-0" />
                            <div>
                              <span className="font-medium">#{order.number}</span>
                              <span className="text-muted-foreground ml-2">{order.customer_name}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{typeLabels[order.type] || order.type}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium tabular-nums">{formatCurrency(Number(order.total))}</span>
                            <button onClick={() => setReprintOrder(order)} className="p-1 rounded hover:bg-muted transition-colors" title="Reimprimir comanda">
                              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              </div>
            )}
          </div>

          {/* SIDE PANELS — top products + activity feed */}
          {!focusMode && (
            <div className="space-y-3">
              <TopProductsToday orders={orders} />
              <LiveActivityFeed orders={orders} calls={waiterCalls} limit={10} />
            </div>
          )}
        </div>

        {reprintOrder && (
          <OrderTicket
            order={{ ...reprintOrder, order_items: reprintOrder.order_items || [] }}
            onClose={() => setReprintOrder(null)}
          />
        )}
      </div>
    </RestaurantLayout>
  );
}
