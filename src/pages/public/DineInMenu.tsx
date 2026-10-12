import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Bell, BellRing, Receipt, HandCoins, ShoppingBag, Check, Disc3 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePublicRestaurant, usePublicCategories, usePublicProducts, usePublicSettings, usePublicTables, usePublicCombos } from '@/hooks/useRestaurantData';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { useRestaurantTheme } from '@/hooks/useRestaurantTheme';
import PromoBanners from '@/components/PromoBanners';
import { sendPushNewOrder, sendPushWaiterCall } from '@/lib/pushNotifications';

type Product = Database['public']['Tables']['products']['Row'];

interface SelectedOption { groupId: string; optionId: string; name: string; price: number; }
interface CartItem {
  product?: Product;
  combo?: { id: string; name: string; price: number; image_url: string | null };
  qty: number;
  notes: string;
  options: SelectedOption[];
}
const itemUnitPrice = (i: CartItem) =>
  i.product ? Number(i.product.promo_price || i.product.price) : Number(i.combo?.price || 0);
const itemName = (i: CartItem) => i.product?.name || i.combo?.name || '';

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DineInMenu() {
  const { slug, tableNumber } = useParams<{ slug: string; tableNumber: string }>();
  const navigate = useNavigate();
  const { data: restaurant, isLoading: loadingRestaurant } = usePublicRestaurant(slug);
  const { data: categories = [] } = usePublicCategories(restaurant?.id);
  const { data: products = [] } = usePublicProducts(restaurant?.id);
  const { data: settings } = usePublicSettings(restaurant?.id);
  const { data: tables = [] } = usePublicTables(restaurant?.id);
  const { data: combos = [] } = usePublicCombos(restaurant?.id);

  useRestaurantTheme(settings?.primary_color, settings?.secondary_color);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [callSent, setCallSent] = useState(false);
  const [billSent, setBillSent] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [showBillConfirm, setShowBillConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const table = tables.find(t => t.number === Number(tableNumber));
  const menuProducts = products.filter(p => !p.sold_out);

  useEffect(() => {
    if (!restaurant?.id || !table?.id) return;
    let sessionId = sessionStorage.getItem('table_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('table_session_id', sessionId);
    }

    const upsertSession = async () => {
      await publicSupabase.from('table_sessions').upsert(
        { restaurant_id: restaurant.id, table_id: table.id, session_id: sessionId, status: 'active', last_seen_at: new Date().toISOString() },
        { onConflict: 'table_id,session_id' }
      );
    };

    upsertSession();
    const interval = setInterval(upsertSession, 60000);
    return () => clearInterval(interval);
  }, [restaurant?.id, table?.id]);

  useEffect(() => {
    if (!restaurant?.id || !table?.id) return;
    const channel = publicSupabase
      .channel(`customer-waiter-${table.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiter_calls', filter: `table_id=eq.${table.id}` },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          if (newStatus === 'acknowledged') {
            toast.success('✅ O garçom já está indo até sua mesa!', { duration: 10000 });
          }
          if (newStatus === 'completed') {
            toast('Atendimento concluído', { duration: 5000 });
          }
        }
      )
      .subscribe();
    return () => { publicSupabase.removeChannel(channel); };
  }, [restaurant?.id, table?.id]);

  const filtered = useMemo(() => {
    let list = menuProducts;
    if (activeCategory) list = list.filter(p => p.category_id === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [search, activeCategory, menuProducts]);

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setSelectedOptions([]);
    setLoadingOptions(true);
    try {
      const { data: groups } = await publicSupabase
        .from('product_option_groups')
        .select('*, product_options(*)')
        .eq('product_id', product.id)
        .order('sort_order');
      setProductOptions(groups || []);
    } catch { setProductOptions([]); }
    setLoadingOptions(false);
  };

  const toggleOption = (groupId: string, option: any, maxSelections: number) => {
    setSelectedOptions(prev => {
      const existing = prev.find(o => o.optionId === option.id);
      if (existing) return prev.filter(o => o.optionId !== option.id);
      const groupCount = prev.filter(o => o.groupId === groupId).length;
      if (groupCount >= maxSelections) {
        const withoutGroup = prev.filter(o => o.groupId !== groupId);
        return [...withoutGroup, { groupId, optionId: option.id, name: option.name, price: Number(option.price) }];
      }
      return [...prev, { groupId, optionId: option.id, name: option.name, price: Number(option.price) }];
    });
  };

  const addToCart = (product: Product) => {
    for (const group of productOptions) {
      if (group.required) {
        const selected = selectedOptions.filter((o: SelectedOption) => o.groupId === group.id);
        if (selected.length < group.min_selections) {
          toast.error(`Selecione pelo menos ${group.min_selections} opção em "${group.name}"`);
          return;
        }
      }
    }
    setCart(prev => [...prev, { product, qty: 1, notes: '', options: [...selectedOptions] }]);
    setSelectedProduct(null);
    setSelectedOptions([]);
    setProductOptions([]);
  };

  const addComboToCart = (combo: any) => {
    setCart(prev => [...prev, {
      combo: { id: combo.id, name: combo.name, price: Number(combo.price), image_url: combo.image_url },
      qty: 1, notes: '', options: [],
    }]);
    toast.success(`${combo.name} adicionado`);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => i.product?.id === productId ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  };

  const cartTotal = cart.reduce((sum, i) => {
    const basePrice = itemUnitPrice(i);
    const optionsPrice = (i.options || []).reduce((s, o) => s + o.price, 0);
    return sum + (basePrice + optionsPrice) * i.qty;
  }, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const couvertValue = settings?.couvert_enabled ? Number(settings.couvert_value || 0) : 0;
  const serviceFee = settings?.service_fee_enabled ? cartTotal * Number(settings.service_fee_percent || 10) / 100 : 0;
  const grandTotal = cartTotal + couvertValue + serviceFee;

  const handleCallWaiter = async () => {
    if (!restaurant || !table) return;
    await publicSupabase.from('waiter_calls').insert({ restaurant_id: restaurant.id, table_id: table.id, type: 'call_waiter' });
    sendPushWaiterCall(restaurant.id, {
      call_id: crypto.randomUUID(),
      table_label: table.label || `Mesa ${table.number}`,
      table_number: table.number,
      type: 'call_waiter',
    }).catch(() => {});
    setCallSent(true);
    setShowCallConfirm(false);
    toast.success('Garçom chamado!');
    setTimeout(() => setCallSent(false), 10000);
  };

  const handleRequestBill = async () => {
    if (!restaurant || !table) return;
    await publicSupabase.from('waiter_calls').insert({ restaurant_id: restaurant.id, table_id: table.id, type: 'request_bill' });
    sendPushWaiterCall(restaurant.id, {
      call_id: crypto.randomUUID(),
      table_label: table.label || `Mesa ${table.number}`,
      table_number: table.number,
      type: 'request_bill',
    }).catch(() => {});
    setBillSent(true);
    setShowBillConfirm(false);
    toast.success('Conta solicitada!');
    setTimeout(() => setBillSent(false), 10000);
  };

  const handleSubmitOrder = async () => {
    if (!restaurant || !table) return;
    if (!restaurant.is_open || restaurant.force_closed) {
      toast.error('O restaurante está fechado no momento. Não é possível enviar pedidos.');
      return;
    }

    // Rate limiting: max 10 orders per 30 minutes for dine-in
    const RATE_KEY = `dinein_timestamps_${restaurant.id}_${table.id}`;
    const now = Date.now();
    const timestamps: number[] = JSON.parse(sessionStorage.getItem(RATE_KEY) || '[]').filter((t: number) => now - t < 1800000);
    if (timestamps.length >= 10) {
      toast.error('Muitos pedidos em pouco tempo. Aguarde alguns minutos.');
      return;
    }

    setSubmitting(true);
    try {
      // Retry logic: handle transient RLS / network glitches.
      // Public table orders cannot depend on `.select()` after insert because
      // anonymous clients are intentionally not allowed to read raw orders.
      let order: any = null;
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const orderId = crypto.randomUUID();
        const { error } = await publicSupabase.from('orders').insert({
          id: orderId,
          restaurant_id: restaurant.id,
          customer_name: `Mesa ${tableNumber}`,
          type: 'dine_in' as const,
          table_id: table.id,
          subtotal: cartTotal,
          delivery_fee: 0,
          total: grandTotal,
        });
        if (!error) { order = { id: orderId }; lastErr = null; break; }
        lastErr = error;
        console.warn(`[order-submit] attempt ${attempt + 1} failed:`, error);
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
      if (!order) throw lastErr || new Error('Falha ao criar pedido');

      const items = cart.map(i => {
        const unit = itemUnitPrice(i);
        const optsTotal = (i.options || []).reduce((s, o) => s + o.price, 0);
        const isCombo = !!i.combo;
        return {
          order_id: order.id,
          product_id: i.product?.id || null,
          name: isCombo ? `[Combo] ${i.combo!.name}` : i.product!.name,
          qty: i.qty,
          unit_price: unit,
          total_price: (unit + optsTotal) * i.qty,
          notes: i.notes || null,
          options: i.options && i.options.length > 0 ? i.options.map(o => ({ name: o.name, price: o.price })) : null,
        };
      });
      const { error: itemsError } = await publicSupabase.from('order_items').insert(items);
      if (itemsError) throw itemsError;

      timestamps.push(now);
      sessionStorage.setItem(RATE_KEY, JSON.stringify(timestamps));

      // Dispara push para os garçons e cozinha
      sendPushNewOrder(restaurant.id, {
        order_id: order.id,
        customer_name: `Mesa ${tableNumber}`,
        type: 'dine_in',
        total: grandTotal,
      }).catch(() => {});

      toast.success('Pedido enviado para a cozinha!');
      setCart([]);
      setCartOpen(false);
      navigate(`/${slug}/mesa/${tableNumber}/conta`);
    } catch (error: any) {
      console.error('[order-submit] final error:', error);
      const msg = error?.message?.includes('row-level security')
        ? 'Pedido bloqueado. Verifique se o restaurante está aberto e tente novamente.'
        : error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')
        ? 'Sem conexão. Verifique seu Wi-Fi e tente de novo.'
        : `Erro ao enviar pedido: ${error?.message || 'tente novamente'}`;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingRestaurant) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!restaurant) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Restaurante não encontrado</p></div>;
  }

  if (['suspended', 'cancelled', 'overdue'].includes(restaurant.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="font-heading text-xl font-bold mb-2">Restaurante indisponível</h1>
          <p className="text-sm text-muted-foreground mb-4">
            O {restaurant.name} está temporariamente fora do ar. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    );
  }

  const isClosed = !restaurant.is_open || restaurant.force_closed;

  return (
    <div className="min-h-screen bg-background pb-40 font-public">
      {isClosed && (
        <div className="bg-destructive/10 text-destructive text-center text-sm py-2 px-4 font-medium">
          🔒 Restaurante fechado no momento — pedidos desabilitados
        </div>
      )}
      <div className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-lg truncate">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground">Mesa {tableNumber}</p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => navigate(`/${slug}/mesa/${tableNumber}/conta`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                aria-label="Ver minha mesa"
              >
                <Receipt className="h-3.5 w-3.5" /> Minha Mesa
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setShowCallConfirm(true)}
              disabled={callSent}
              aria-label="Chamar garçom"
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                callSent
                  ? 'bg-success/15 text-success border border-success/30'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              }`}
            >
              {callSent ? (
                <><Check className="h-4 w-4" /> Garçom a caminho</>
              ) : (
                <><BellRing className="h-4 w-4" /> Chamar garçom</>
              )}
            </button>
            <button
              onClick={() => setShowBillConfirm(true)}
              disabled={billSent}
              aria-label="Pedir a conta"
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] border ${
                billSent
                  ? 'bg-success/15 text-success border-success/30'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              }`}
            >
              {billSent ? (
                <><Check className="h-4 w-4" /> Conta solicitada</>
              ) : (
                <><HandCoins className="h-4 w-4" /> Pedir a conta</>
              )}
            </button>
          </div>
          {(settings as any)?.music_requests_enabled === true && (
            <button
              onClick={() => navigate(`/${slug}/balada?mesa=${tableNumber}`)}
              className="w-full mb-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-500 text-white px-4 py-3 text-sm font-bold hover:opacity-90 transition-opacity shadow-md"
              aria-label="Pedir música pro DJ"
            >
              <Disc3 className="h-4 w-4 animate-spin-slow" /> 🎵 PEDIR MÚSICA PRO DJ
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar no cardápio..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm" />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${!activeCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>Tudo</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${activeCategory === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PromoBanners
        restaurantId={restaurant.id}
        onCategoryClick={(catId) => {
          setActiveCategory(catId);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onProductClick={(productId) => {
          const p = products.find((pr) => pr.id === productId);
          if (p) handleSelectProduct(p);
        }}
      />

      {/* Combos showcase */}
      {combos.length > 0 && !activeCategory && !search && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-heading font-bold text-lg">🔥 Combos</h2>
            <span className="text-xs text-muted-foreground">Economize pedindo junto</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            {combos.map((c: any) => {
              const itemsSum = (c.product_combo_items || []).reduce((s: number, it: any) => s + Number(it.products?.price || 0) * (it.quantity || 1), 0);
              const save = itemsSum - Number(c.price);
              return (
                <div key={c.id} className="shrink-0 w-60 card-elevated overflow-hidden">
                  <div className="h-28 bg-muted flex items-center justify-center text-3xl overflow-hidden">
                    {c.image_url ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" /> : '🍔'}
                  </div>
                  <div className="p-3">
                    <h3 className="font-heading font-semibold text-sm truncate">{c.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 min-h-[2rem]">
                      {(c.product_combo_items || []).map((it: any) => `${it.quantity}x ${it.products?.name || ''}`).join(' + ')}
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      {save > 0 && <span className="text-[10px] text-success font-medium">-{formatCurrency(save)}</span>}
                      <span className="font-heading font-bold text-sm ml-auto">{formatCurrency(Number(c.price))}</span>
                    </div>
                    <button onClick={() => addComboToCart(c)}
                      className="w-full mt-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all">
                      Adicionar combo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {filtered.map(p => {
          const inCart = cart.filter(i => i.product?.id === p.id);
          const totalInCart = inCart.reduce((s, i) => s + i.qty, 0);
          return (
            <div key={p.id} className="card-elevated p-3 flex gap-3">
              <div className="h-20 w-20 rounded-xl overflow-hidden shrink-0 bg-muted flex items-center justify-center text-2xl">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : '🍽️'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{p.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    {p.promo_price ? (
                      <>
                        <span className="text-xs text-muted-foreground line-through mr-1">{formatCurrency(Number(p.price))}</span>
                        <span className="text-sm font-bold text-primary">{formatCurrency(Number(p.promo_price))}</span>
                      </>
                    ) : (
                      <span className="text-sm font-bold">{formatCurrency(Number(p.price))}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {totalInCart > 0 && <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{totalInCart}</span>}
                    <button onClick={() => handleSelectProduct(p)} className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground active:scale-95 transition-transform">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product detail modal with options */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => { setSelectedProduct(null); setProductOptions([]); setSelectedOptions([]); }} />
          <div className="relative w-full max-w-lg bg-card rounded-t-2xl shadow-xl animate-reveal-up max-h-[80vh] overflow-y-auto">
            <div className="p-5">
              <button onClick={() => { setSelectedProduct(null); setProductOptions([]); setSelectedOptions([]); }} className="absolute top-4 right-4 p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors z-10">
                <Minus className="h-4 w-4" />
              </button>
              <div className="h-40 rounded-xl bg-muted flex items-center justify-center text-4xl mb-3 overflow-hidden">
                {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" /> : '🍽️'}
              </div>
              <h2 className="font-heading text-lg font-bold">{selectedProduct.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedProduct.description}</p>
              <div className="flex items-baseline gap-2 mt-2">
                {selectedProduct.promo_price && <span className="text-sm text-muted-foreground line-through">{formatCurrency(Number(selectedProduct.price))}</span>}
                <span className="font-heading font-bold text-lg">{formatCurrency(Number(selectedProduct.promo_price || selectedProduct.price))}</span>
              </div>

              {loadingOptions && <div className="py-3 text-center text-sm text-muted-foreground">Carregando opções...</div>}
              {productOptions.length > 0 && (
                <div className="mt-3 space-y-3">
                  {productOptions.map((group: any) => (
                    <div key={group.id} className="border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-sm font-semibold">{group.name}</h4>
                        {group.required && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Obrigatório</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {group.min_selections === group.max_selections ? `Escolha ${group.min_selections}` : `De ${group.min_selections} a ${group.max_selections}`}
                      </p>
                      <div className="space-y-1.5">
                        {(group.product_options || []).filter((o: any) => o.active).sort((a: any, b: any) => a.sort_order - b.sort_order).map((option: any) => {
                          const isSelected = selectedOptions.some(o => o.optionId === option.id);
                          return (
                            <button key={option.id} onClick={() => toggleOption(group.id, option, group.max_selections)}
                              className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-all ${
                                isSelected ? 'bg-primary/10 border-primary' : 'border-border hover:border-primary/40'
                              }`}>
                              <span className="font-medium">{option.name}</span>
                              {Number(option.price) > 0 && <span className="text-xs text-muted-foreground">+{formatCurrency(Number(option.price))}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => addToCart(selectedProduct)}
                className="w-full mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> Adicionar
                {selectedOptions.length > 0 && (
                  <span>({formatCurrency(Number(selectedProduct.promo_price || selectedProduct.price) + selectedOptions.reduce((s, o) => s + o.price, 0))})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
          <div className="max-w-lg mx-auto">
            <button onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-lg active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary-foreground text-primary text-[10px] font-bold flex items-center justify-center">{cartCount}</span>
                </div>
                <span className="font-medium text-sm">Ver pedido</span>
              </div>
              <span className="font-bold">{formatCurrency(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Seu Pedido — Mesa {tableNumber}</SheetTitle>
            <SheetDescription>Confira os itens e envie seu pedido para o atendimento.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {cart.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Seu carrinho está vazio</p>
            )}
            {cart.map((item, idx) => {
              const base = itemUnitPrice(item);
              const optionsTotal = (item.options || []).reduce((s, o) => s + o.price, 0);
              const unit = base + optionsTotal;
              const lineTotal = unit * item.qty;
              const image = item.product?.image_url || item.combo?.image_url || null;
              return (
                <div
                  key={`${item.product?.id || item.combo?.id}-${idx}`}
                  className="flex gap-3 p-3 rounded-2xl bg-muted/40 border border-border"
                >
                  {image ? (
                    <img src={image} alt="" className="h-14 w-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">
                        {item.combo && (
                          <span className="mr-1 inline-flex items-center rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold align-middle">
                            COMBO
                          </span>
                        )}
                        {itemName(item)}
                      </p>
                      <button
                        onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                        className="text-[11px] text-muted-foreground hover:text-destructive flex-shrink-0"
                        aria-label="Remover item"
                      >
                        Remover
                      </button>
                    </div>

                    {item.options && item.options.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {item.options.map((o, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground flex justify-between gap-2">
                            <span className="truncate">+ {o.name}</span>
                            {o.price > 0 && <span className="flex-shrink-0">{formatCurrency(o.price)}</span>}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty: Math.max(1, c.qty - 1) } : c))}
                          className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                        <button
                          onClick={() => setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty: c.qty + 1 } : c))}
                          className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground leading-none">
                          {formatCurrency(unit)} × {item.qty}
                        </p>
                        <p className="text-sm font-bold leading-tight mt-0.5">{formatCurrency(lineTotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 pt-4 border-t border-border">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(cartTotal)}</span></div>
            {couvertValue > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Couvert artístico</span><span>{formatCurrency(couvertValue)}</span></div>}
            {serviceFee > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Taxa de serviço ({settings?.service_fee_percent}%)</span><span>{formatCurrency(serviceFee)}</span></div>}
            <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
          </div>
          <button onClick={handleSubmitOrder} disabled={submitting}
            className="w-full mt-6 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {submitting ? 'Enviando...' : 'Enviar Pedido para a Cozinha'}
          </button>
          <p className="text-center text-xs text-muted-foreground mt-2">O pagamento será realizado com o garçom</p>
        </SheetContent>
      </Sheet>

      <Dialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Chamar Garçom</DialogTitle>
            <DialogDescription>O garçom será notificado e virá até a Mesa {tableNumber}.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowCallConfirm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleCallWaiter} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">Confirmar</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBillConfirm} onOpenChange={setShowBillConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-warning" /> Pedir a Conta</DialogTitle>
            <DialogDescription>O garçom trará a conta para a Mesa {tableNumber}.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowBillConfirm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleRequestBill} className="flex-1 rounded-xl bg-warning py-2.5 text-sm font-bold text-primary-foreground hover:bg-warning/90 transition-colors">Pedir Conta</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
