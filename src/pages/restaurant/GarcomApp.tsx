import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, Plus, Minus, Search, Send, ShoppingBag, Users, LogOut,
  Coffee, Trash2, ChevronRight, X, Zap, Check, Disc3, TrendingUp, Beer, Download
} from 'lucide-react';
import WaiterMusicRequestSheet from '@/components/nightlife/WaiterMusicRequestSheet';
import { useAuth } from '@/hooks/useAuth';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant, useRestaurantTables, useRestaurantCategories, useRestaurantProducts } from '@/hooks/useRestaurantData';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineDb, generateLocalId } from '@/lib/offlineDb';
import OfflineIndicator from '@/components/OfflineIndicator';
import InstallPWABanner from '@/components/InstallPWABanner';
import NotificationPrefsToggle from '@/components/NotificationPrefsToggle';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type View = 'tables' | 'commands' | 'menu';

interface SelectedOption { groupId: string; optionId: string; name: string; price: number; }

interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number; // base price (sem opcionais)
  notes: string;
  options: SelectedOption[];
}

export default function GarcomApp() {
  const navigate = useNavigate();
  const { restaurantId, user, signOut, loading } = useAuth();
  const plan = usePlanFeatures();
  const queryClient = useQueryClient();
  const { online } = useOfflineSync();

  const [view, setView] = useState<View>('tables');
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<any | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartStorageKey = user?.id && restaurantId && selectedCommand?.id
    ? `garcom_cart:${restaurantId}:${user.id}:${selectedCommand.id}`
    : null;
  const cartHydratedRef = useRef<string | null>(null);
  const [musicSheetOpen, setMusicSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showNewCommand, setShowNewCommand] = useState(false);
  const [newCommandName, setNewCommandName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal de opcionais
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [productNotes, setProductNotes] = useState('');
  const { data: restaurant } = useRestaurant();
  const { data: tables = [] } = useRestaurantTables();
  const { data: categories = [] } = useRestaurantCategories();
  const { data: products = [] } = useRestaurantProducts();

  // Auth gate
  useEffect(() => {
    if (!loading && !user) navigate('/restaurant/login');
  }, [loading, user, navigate]);

  // Hydrate cart per command
  useEffect(() => {
    if (!cartStorageKey) return;
    if (cartHydratedRef.current === cartStorageKey) return;
    try {
      const raw = window.localStorage.getItem(cartStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setCart(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCart([]);
    }
    cartHydratedRef.current = cartStorageKey;
  }, [cartStorageKey]);

  // Persist cart per command
  useEffect(() => {
    if (!cartStorageKey || cartHydratedRef.current !== cartStorageKey) return;
    try {
      if (cart.length === 0) window.localStorage.removeItem(cartStorageKey);
      else window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {}
  }, [cart, cartStorageKey]);

  // Commands for selected table (online + offline pending)
  const { data: serverCommands = [], refetch: refetchCommands } = useQuery({
    queryKey: ['commands-by-table', selectedTable?.id],
    queryFn: async () => {
      if (!selectedTable?.id) return [];
      const { data } = await (supabase as any)
        .from('table_commands')
        .select('*')
        .eq('table_id', selectedTable.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedTable?.id,
    refetchInterval: 10000,
  });

  const pendingCommands = useLiveQuery(
    () => selectedTable?.id
      ? offlineDb.pendingCommands.where('tableId').equals(selectedTable.id).toArray()
      : Promise.resolve([]),
    [selectedTable?.id]
  ) ?? [];

  const allCommands = useMemo(() => [
    ...serverCommands,
    ...pendingCommands.map(c => ({
      id: c.localId,
      customer_name: c.customerName + ' (offline)',
      opened_at: new Date(c.createdAt).toISOString(),
      __pending: true,
    })),
  ], [serverCommands, pendingCommands]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p: any) => p.active && !p.sold_out);
    if (activeCategory) list = list.filter((p: any) => p.category_id === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p: any) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);

  const lineUnitPrice = (i: CartItem) =>
    i.unitPrice + (i.options || []).reduce((s, o) => s + o.price, 0);
  const cartTotal = cart.reduce((s, i) => s + i.qty * lineUnitPrice(i), 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const openProduct = async (product: any) => {
    setSelectedProduct(product);
    setSelectedOptions([]);
    setProductNotes('');
    setProductOptions([]);
    setLoadingOptions(true);
    try {
      const { data: groups } = await (supabase as any)
        .from('product_option_groups')
        .select('*, product_options(*)')
        .eq('product_id', product.id)
        .order('sort_order');
      setProductOptions(groups || []);
    } catch {
      setProductOptions([]);
    }
    setLoadingOptions(false);
  };

  const toggleOption = (groupId: string, option: any, maxSelections: number) => {
    setSelectedOptions(prev => {
      const existing = prev.find(o => o.optionId === option.id);
      if (existing) return prev.filter(o => o.optionId !== option.id);
      const groupCount = prev.filter(o => o.groupId === groupId).length;
      const entry = { groupId, optionId: option.id, name: option.name, price: Number(option.price) };
      if (groupCount >= maxSelections) {
        const withoutGroup = prev.filter(o => o.groupId !== groupId);
        return [...withoutGroup, entry];
      }
      return [...prev, entry];
    });
  };

  const confirmAddToCart = () => {
    if (!selectedProduct) return;
    for (const group of productOptions) {
      if (group.required) {
        const sel = selectedOptions.filter(o => o.groupId === group.id);
        if (sel.length < (group.min_selections || 1)) {
          toast.error(`Selecione pelo menos ${group.min_selections || 1} em "${group.name}"`);
          return;
        }
      }
    }
    const price = Number(selectedProduct.promo_price ?? selectedProduct.price);
    setCart(prev => [...prev, {
      lineId: generateLocalId(),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      qty: 1,
      unitPrice: price,
      notes: productNotes,
      options: [...selectedOptions],
    }]);
    toast.success(selectedProduct.name, { duration: 1200 });
    setSelectedProduct(null);
    setProductOptions([]);
    setSelectedOptions([]);
    setProductNotes('');
  };

  const handleProductClick = async (product: any) => {
    // Sempre abre modal — checa se tem opcionais; se não tiver, ainda mostra detalhe + qty rápida
    await openProduct(product);
  };

  const updateQty = (lineId: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.lineId === lineId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    );
  };

  const removeItem = (lineId: string) => {
    setCart(prev => prev.filter(i => i.lineId !== lineId));
  };

  const handleCreateCommand = async () => {
    if (!restaurantId || !selectedTable?.id || !newCommandName.trim()) return;
    setSubmitting(true);

    if (online) {
      const { data, error } = await (supabase as any)
        .from('table_commands')
        .insert({
          restaurant_id: restaurantId,
          table_id: selectedTable.id,
          customer_name: newCommandName.trim(),
          created_by: user?.id || null,
        })
        .select()
        .single();
      setSubmitting(false);
      if (error) {
        toast.error('Erro ao abrir comanda');
        return;
      }
      toast.success(`Comanda "${newCommandName}" aberta!`);
      setNewCommandName('');
      setShowNewCommand(false);
      refetchCommands();
      // Auto-select new command and go to menu
      setSelectedCommand(data);
      setView('menu');
    } else {
      // Offline queue
      await offlineDb.pendingCommands.add({
        localId: generateLocalId(),
        restaurantId,
        tableId: selectedTable.id,
        customerName: newCommandName.trim(),
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
      });
      setSubmitting(false);
      toast.success(`Comanda "${newCommandName}" salva offline`);
      setNewCommandName('');
      setShowNewCommand(false);
    }
  };

  const handleSendOrder = async () => {
    if (!restaurantId || !selectedTable?.id || cart.length === 0) return;
    setSubmitting(true);

    const items = cart.map(i => {
      const optionsTotal = (i.options || []).reduce((s, o) => s + o.price, 0);
      const lineUnit = i.unitPrice + optionsTotal;
      return {
        productId: i.productId,
        name: i.name,
        qty: i.qty,
        unitPrice: lineUnit,
        totalPrice: i.qty * lineUnit,
        notes: i.notes,
        options: i.options || [],
      };
    });
    const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
    const customerName = selectedCommand?.customer_name?.replace(' (offline)', '') || `Mesa ${selectedTable.number}`;
    const commandId = selectedCommand?.__pending ? selectedCommand.id : (selectedCommand?.id || null);

    if (online && !selectedCommand?.__pending) {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          table_id: selectedTable.id,
          type: 'dine_in' as any,
          customer_name: customerName,
          subtotal,
          total: subtotal,
          status: 'new' as any,
          served_by: user?.id || null,
        })
        .select()
        .single();

      if (orderErr || !order) {
        setSubmitting(false);
        toast.error('Erro ao enviar pedido');
        return;
      }

      const itemsPayload = items.map(it => ({
        order_id: order.id,
        product_id: it.productId,
        name: it.name,
        qty: it.qty,
        unit_price: it.unitPrice,
        total_price: it.totalPrice,
        notes: it.notes || null,
        options: it.options as any,
        command_id: commandId,
      }));
      await (supabase as any).from('order_items').insert(itemsPayload);
      setSubmitting(false);
      toast.success('Pedido enviado para a cozinha! 🚀');
      queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['my-sales'] });
    } else {
      // Offline queue
      await offlineDb.pendingOrders.add({
        localId: generateLocalId(),
        restaurantId,
        tableId: selectedTable.id,
        commandId,
        customerName,
        items,
        subtotal,
        total: subtotal,
        servedBy: user?.id || null,
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
      });
      setSubmitting(false);
      toast.success('Pedido salvo offline — sincronizará ao voltar a conexão');
    }

    setCart([]);
    setShowCart(false);
    setView('commands');
  };

  // ============ VIEWS ============

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {view !== 'tables' && (
              <button
                onClick={() => {
                  if (view === 'menu') { setView('commands'); setCart([]); }
                  else { setView('tables'); setSelectedTable(null); setSelectedCommand(null); }
                }}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-muted-foreground leading-none flex items-center gap-1">
                <span>👤</span>
                <span className="truncate">
                  {(user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'Garçom'}
                </span>
              </p>
              <h1 className="font-bold text-sm truncate">
                {view === 'tables' ? (restaurant?.name || 'Bora Uai') :
                 view === 'commands' ? `Comandas · ${selectedTable?.label || `Mesa ${selectedTable?.number}`}` :
                 `Itens · ${selectedCommand?.customer_name || 'Cardápio'}`}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <OfflineIndicator />
            <NotificationPrefsToggle variant="compact" />
            <a
              href="/borauai.apk"
              download="borauai.apk"
              title="Baixar App (.apk)"
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" />
            </a>
            {view === 'tables' && (
              <>
                <Link
                  to="/restaurant"
                  title="Voltar ao painel do restaurante"
                  className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-foreground hover:bg-muted/70 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Painel
                </Link>
                <button onClick={() => signOut()} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Sair">
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* TABLES VIEW */}
        {view === 'tables' && (
          <div className="p-3 space-y-3">
            <PushNotificationToggle />
            {plan.hasQuickSale && (
              <Link
                to="/garcom/balada"
                className="block w-full card-elevated p-4 flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">⚡ Modo Balada</p>
                    <p className="text-[11px] text-muted-foreground">Vender em pé, cobrar na hora</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {plan.hasQuickSale && (
              <Link
                to="/garcom/bar"
                className="block w-full card-elevated p-4 flex items-center justify-between gap-3 active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Beer className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">🍺 Painel do Bar</p>
                    <p className="text-[11px] text-muted-foreground">Fila de retirada (barman)</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            <Link
              to="/garcom/minhas-vendas"
              className="block w-full card-elevated p-4 flex items-center justify-between gap-3 active:scale-95 transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-bold text-sm">📊 Minhas Vendas</p>
                  <p className="text-[11px] text-muted-foreground">Total, ranking e histórico</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div className="grid grid-cols-2 gap-3">
              {tables.filter((t: any) => t.status !== 'inactive').map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTable(t); setView('commands'); }}
                  className="card-elevated p-4 text-left active:scale-95 transition-transform"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-2xl">#{t.number}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.label || `Mesa ${t.number}`}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    <Users className="inline h-3 w-3 mr-0.5" />{t.capacity} lugares
                  </p>
                </button>
              ))}
              {tables.length === 0 && (
                <p className="col-span-2 text-center text-muted-foreground py-12 text-sm">Nenhuma mesa cadastrada</p>
              )}
            </div>
          </div>
        )}

        {/* COMMANDS VIEW */}
        {view === 'commands' && selectedTable && (
          <div className="p-3 space-y-3">
            <button
              onClick={() => setShowNewCommand(true)}
              className="w-full card-elevated p-4 flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 text-primary active:scale-95 transition-transform"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Abrir nova comanda</span>
            </button>

            <button
              onClick={() => setMusicSheetOpen(true)}
              className="w-full card-elevated p-3 flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 border border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300 active:scale-95 transition-transform"
            >
              <Disc3 className="h-4 w-4" />
              <span className="text-sm font-semibold">🎵 Pedir música pro DJ</span>
            </button>

            {allCommands.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nenhuma comanda aberta. Crie uma para começar.
              </p>
            ) : (
              allCommands.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCommand(c); setView('menu'); }}
                  className="w-full card-elevated p-4 text-left active:scale-95 transition-transform flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate flex items-center gap-2">
                      {c.customer_name}
                      {c.__pending && <Badge variant="outline" className="text-[9px] h-4">Offline</Badge>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Aberta às {new Date(c.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              ))
            )}

            {/* Quick "no command" entry */}
            <button
              onClick={() => { setSelectedCommand(null); setView('menu'); }}
              className="w-full p-3 text-sm text-muted-foreground border border-border rounded-lg active:scale-95 transition-transform"
            >
              Lançar para a mesa toda (sem comanda)
            </button>
          </div>
        )}

        {/* MENU VIEW */}
        {view === 'menu' && (
          <div className="space-y-3">
            <div className="sticky top-0 z-10 bg-background border-b border-border p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-none">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${!activeCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Todos
                </button>
                {categories.filter((c: any) => c.active).map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${activeCategory === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 grid grid-cols-1 gap-2">
              {filteredProducts.map((p: any) => {
                const linesForProduct = cart.filter(i => i.productId === p.id);
                const totalQty = linesForProduct.reduce((s, i) => s + i.qty, 0);
                const price = Number(p.promo_price ?? p.price);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    className="card-elevated p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Coffee className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                      <p className="text-sm font-bold text-primary">{fmt(price)}</p>
                    </div>
                    <div className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Plus className="h-4 w-4" />
                      {totalQty > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center">
                          {totalQty}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Nenhum produto encontrado</p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating cart button */}
      {view === 'menu' && cart.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-3 right-3 z-20 bg-primary text-primary-foreground rounded-2xl shadow-lg px-4 py-3.5 flex items-center justify-between active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <span className="font-semibold text-sm">Ver pedido</span>
          </div>
          <span className="font-bold tabular-nums">{fmt(cartTotal)}</span>
        </button>
      )}

      {/* Cart sheet */}
      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {selectedCommand ? `Comanda: ${selectedCommand.customer_name?.replace(' (offline)', '')}` : `Mesa ${selectedTable?.number}`}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-2 mt-4">
            {cart.map(i => {
              const optionsTotal = (i.options || []).reduce((s, o) => s + o.price, 0);
              const lineUnit = i.unitPrice + optionsTotal;
              return (
                <div key={i.lineId} className="py-2 border-b border-border">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{i.name}</p>
                      {i.options && i.options.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {i.options.map((o, idx) => (
                            <li key={idx} className="text-[11px] text-muted-foreground flex justify-between gap-2">
                              <span>+ {o.name}</span>
                              {o.price > 0 && <span>{fmt(o.price)}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {i.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5">Obs: {i.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{fmt(lineUnit)} cada</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(i.lineId, -1)} className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center font-bold text-sm">{i.qty}</span>
                      <button onClick={() => updateQty(i.lineId, 1)} className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="w-16 text-right font-bold tabular-nums text-sm">{fmt(i.qty * lineUnit)}</span>
                    <button onClick={() => removeItem(i.lineId)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary text-lg">{fmt(cartTotal)}</span>
            </div>
            <Button
              onClick={handleSendOrder}
              disabled={submitting || cart.length === 0}
              className="w-full h-12 text-base"
            >
              <Send className="h-4 w-4 mr-2" />
              {online ? 'Enviar para cozinha' : 'Salvar offline'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* New command dialog */}
      <Dialog open={showNewCommand} onOpenChange={setShowNewCommand}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova comanda — {selectedTable?.label || `Mesa ${selectedTable?.number}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome (ex: João, Cliente 1...)"
              value={newCommandName}
              onChange={(e) => setNewCommandName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCommand(); }}
              maxLength={40}
              autoFocus
            />
            <Button onClick={handleCreateCommand} disabled={submitting || !newCommandName.trim()} className="w-full">
              Abrir comanda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product detail / options dialog */}
      <Dialog
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProduct(null);
            setProductOptions([]);
            setSelectedOptions([]);
            setProductNotes('');
          }
        }}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {selectedProduct && (
            <div className="max-h-[85vh] overflow-y-auto">
              {selectedProduct.image_url && (
                <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-40 object-cover" />
              )}
              <div className="p-4 space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-base">{selectedProduct.name}</DialogTitle>
                </DialogHeader>
                {selectedProduct.description && (
                  <p className="text-xs text-muted-foreground">{selectedProduct.description}</p>
                )}
                <p className="text-base font-bold text-primary">
                  {fmt(Number(selectedProduct.promo_price ?? selectedProduct.price))}
                </p>

                {loadingOptions && (
                  <div className="py-3 text-center text-xs text-muted-foreground">Carregando opções...</div>
                )}

                {!loadingOptions && productOptions.length > 0 && (
                  <div className="space-y-3">
                    {productOptions.map((group: any) => (
                      <div key={group.id} className="border border-border rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold">{group.name}</h4>
                          {group.required && (
                            <Badge variant="destructive" className="text-[9px] h-4">Obrigatório</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          {group.min_selections === group.max_selections
                            ? `Escolha ${group.min_selections}`
                            : `De ${group.min_selections} a ${group.max_selections}`}
                        </p>
                        <div className="space-y-1.5">
                          {(group.product_options || [])
                            .filter((o: any) => o.active)
                            .sort((a: any, b: any) => a.sort_order - b.sort_order)
                            .map((option: any) => {
                              const isSelected = selectedOptions.some(o => o.optionId === option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => toggleOption(group.id, option, group.max_selections)}
                                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-all ${
                                    isSelected ? 'bg-primary/10 border-primary' : 'border-border hover:border-primary/40'
                                  }`}
                                >
                                  <span className="font-medium flex items-center gap-2">
                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                                    {option.name}
                                  </span>
                                  {Number(option.price) > 0 && (
                                    <span className="text-xs text-muted-foreground">+{fmt(Number(option.price))}</span>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-[11px] uppercase text-muted-foreground font-medium">Observações</label>
                  <Input
                    placeholder="Ex: sem cebola, ponto da carne..."
                    value={productNotes}
                    onChange={(e) => setProductNotes(e.target.value)}
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                <Button onClick={confirmAddToCart} disabled={loadingOptions} className="w-full h-11">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                  {selectedOptions.length > 0 && (
                    <span className="ml-1">
                      · {fmt(Number(selectedProduct.promo_price ?? selectedProduct.price) + selectedOptions.reduce((s, o) => s + o.price, 0))}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PWA Garçom — só aparece após login (este componente só monta com user autenticado) */}
      {user && (
        <InstallPWABanner
          variant="garcom"
          manifestHref="/manifest-garcom.webmanifest"
        />
      )}

      {selectedTable && restaurantId && (
        <WaiterMusicRequestSheet
          open={musicSheetOpen}
          onOpenChange={setMusicSheetOpen}
          restaurantId={restaurantId}
          tableLabel={selectedTable.label || `Mesa ${selectedTable.number}`}
          customerName={selectedCommand?.customer_name?.replace(' (offline)', '')}
        />
      )}
    </div>
  );
}
