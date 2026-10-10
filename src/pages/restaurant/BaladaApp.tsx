import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, LogOut, Plus, Minus, Trash2, Zap, Wallet, CreditCard, QrCode, X, Tag, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurant, useRestaurantProducts, useRestaurantSettings } from '@/hooks/useRestaurantData';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { offlineDb, generateLocalId } from '@/lib/offlineDb';
import { insertQuickSale, type QuickSaleCartItem } from '@/hooks/useQuickSale';
import OfflineIndicator from '@/components/OfflineIndicator';
import QrScannerButton from '@/components/QrScannerButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card';

const paymentOptions: { key: PaymentMethod; label: string; icon: typeof Wallet; color: string }[] = [
  { key: 'pix', label: 'PIX', icon: QrCode, color: 'bg-emerald-500' },
  { key: 'cash', label: 'Dinheiro', icon: Wallet, color: 'bg-amber-500' },
  { key: 'credit_card', label: 'Crédito', icon: CreditCard, color: 'bg-blue-500' },
  { key: 'debit_card', label: 'Débito', icon: CreditCard, color: 'bg-indigo-500' },
];

const playKaching = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(1200, ctx.currentTime);
    o.frequency.setValueAtTime(1600, ctx.currentTime + 0.08);
    o.frequency.setValueAtTime(2000, ctx.currentTime + 0.16);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.35);
  } catch {}
};

export default function BaladaApp() {
  const { user, restaurantId, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: restaurant } = useRestaurant();
  const { data: settings } = useRestaurantSettings();
  const { data: products = [] } = useRestaurantProducts();
  const plan = usePlanFeatures();
  const online = useOnlineStatus();

  const cartStorageKey = user?.id && restaurantId ? `balada_cart:${restaurantId}:${user.id}` : null;
  const [cart, setCart] = useState<QuickSaleCartItem[]>([]);
  const cartHydrated = useRef(false);
  const [search, setSearch] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [filter, setFilter] = useState<'favorites' | 'all'>('favorites');
  const sentSale = useRef(false);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) navigate('/restaurant/login');
  }, [authLoading, user, navigate]);

  // Hydrate cart from localStorage when user/restaurant ready
  useEffect(() => {
    if (!cartStorageKey || cartHydrated.current) return;
    try {
      const raw = window.localStorage.getItem(cartStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as QuickSaleCartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
      }
    } catch {}
    cartHydrated.current = true;
  }, [cartStorageKey]);

  // Persist cart on change
  useEffect(() => {
    if (!cartStorageKey || !cartHydrated.current) return;
    try {
      if (cart.length === 0) window.localStorage.removeItem(cartStorageKey);
      else window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {}
  }, [cart, cartStorageKey]);

  // Pending sales counter from Dexie
  const pendingSales = useLiveQuery(() => offlineDb.pendingQuickSales.toArray(), []) ?? [];

  const enabled = (settings as any)?.quick_sale_enabled === true;
  const planAllowed = plan.tier === 'professional' || plan.tier === 'premium';

  const allProducts = (products as any[]).filter(
    (p) => p.active && !p.sold_out
  );
  const favoriteProducts = allProducts.filter((p) => p.is_quick_sale === true);
  const visibleProducts = (filter === 'favorites' ? favoriteProducts : allProducts).filter((p) =>
    search ? p.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + c.totalPrice, 0),
    [cart]
  );

  const addToCart = (p: any) => {
    setCart((prev) => {
      const found = prev.find((it) => it.productId === p.id);
      if (found) {
        return prev.map((it) =>
          it.productId === p.id
            ? { ...it, qty: it.qty + 1, totalPrice: (it.qty + 1) * it.unitPrice }
            : it
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          qty: 1,
          unitPrice: Number(p.promo_price || p.price),
          totalPrice: Number(p.promo_price || p.price),
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) =>
          it.productId === productId
            ? { ...it, qty: it.qty + delta, totalPrice: (it.qty + delta) * it.unitPrice }
            : it
        )
        .filter((it) => it.qty > 0)
    );
  };

  const removeItem = (productId: string) =>
    setCart((prev) => prev.filter((it) => it.productId !== productId));

  // Wristband (pulseira) state
  const [wristbandCode, setWristbandCode] = useState('');
  const [wristbandData, setWristbandData] = useState<any | null>(null);
  const [wristbandError, setWristbandError] = useState<string | null>(null);
  const [checkingWb, setCheckingWb] = useState(false);

  const lookupWristband = async (rawCode: string) => {
    if (!restaurantId) return;
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      setWristbandData(null);
      setWristbandError(null);
      return;
    }
    setCheckingWb(true);
    setWristbandError(null);
    const { data, error } = await (supabase as any)
      .from('nightlife_wristbands')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('code', code)
      .maybeSingle();
    setCheckingWb(false);
    if (error || !data) {
      setWristbandData(null);
      setWristbandError('Pulseira não encontrada');
      return;
    }
    if (data.status !== 'active') {
      setWristbandData(null);
      setWristbandError('Pulseira encerrada');
      return;
    }
    setWristbandData(data);
  };

  const handleCharge = async (method: PaymentMethod) => {
    if (cart.length === 0 || !restaurantId || sentSale.current) return;
    if (!wristbandData) {
      toast.error('Informe o número da pulseira para lançar a venda');
      return;
    }

    sentSale.current = true;
    setPaying(true);

    const payload = {
      restaurantId,
      servedBy: user?.id || null,
      customerName: wristbandData ? `Pulseira ${wristbandData.code}` : 'Balada',
      paymentMethod: method,
      items: cart,
      total: subtotal,
      wristbandId: wristbandData?.id || null,
      wristbandCode: wristbandData?.code || null,
      postPaid: false, // sempre paga na hora
    };

    try {
      if (online) {
        const ok = await insertQuickSale(payload);
        if (!ok) {
          await offlineDb.pendingQuickSales.add({
            localId: generateLocalId(),
            ...payload,
            createdAt: Date.now(),
            attempts: 0,
            status: 'pending',
          });
          toast.info('Sem conexão — venda salva offline e será sincronizada');
        } else if (wristbandData) {
          toast.success(`✅ ${fmt(subtotal)} pago! Pulseira ${wristbandData.code} → retira no bar`);
        } else {
          toast.success(`✅ ${fmt(subtotal)} vendido!`);
        }
      } else {
        await offlineDb.pendingQuickSales.add({
          localId: generateLocalId(),
          ...payload,
          createdAt: Date.now(),
          attempts: 0,
          status: 'pending',
        });
        toast.info('Sem conexão — venda salva offline');
      }

      playKaching();
      setCart([]);
      setShowPay(false);
      setWristbandCode('');
      setWristbandData(null);
    } finally {
      setPaying(false);
      sentSale.current = false;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  }

  // Plan or feature gate
  if (!plan.loading && !planAllowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <Zap className="h-12 w-12 text-primary mb-3" />
        <h2 className="font-heading font-bold text-xl mb-1">Modo Balada</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Disponível nos planos <strong>Pro</strong> e <strong>Premium</strong>. Faça upgrade para liberar a venda avulsa móvel.
        </p>
        <Link to="/restaurant/billing" className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          Fazer upgrade do plano
        </Link>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <Zap className="h-12 w-12 text-muted-foreground mb-3" />
        <h2 className="font-heading font-bold text-xl mb-1">Modo Balada desativado</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ative o Modo Balada nas configurações do restaurante para começar a vender em pé.
        </p>
        <Link to="/garcom" className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/garcom" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-primary leading-none flex items-center gap-1">
                <Zap className="h-3 w-3" /> Modo Balada
              </p>
              <h1 className="font-bold text-sm truncate">{restaurant?.name || 'Vender em pé'}</h1>
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <span>👤</span>
                <span className="truncate font-semibold">
                  {(user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'Garçom'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {pendingSales.length > 0 && (
              <span className="text-[10px] rounded-full bg-warning/20 text-warning px-2 py-0.5">
                {pendingSales.length} offline
              </span>
            )}
            <OfflineIndicator />
            <Link
              to="/restaurant"
              title="Voltar ao painel"
              className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/70 transition-colors"
            >
              Painel
            </Link>
            <button onClick={() => signOut()} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Sair">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="px-3 pb-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
          <Link to="/restaurant" className="hover:text-foreground hover:underline transition-colors">Painel</Link>
          <span>›</span>
          <span className="text-foreground font-medium">Modo Balada</span>
        </nav>

        {/* Filters */}
        <div className="px-3 pb-2 flex items-center gap-2">
          <input
            type="search"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setFilter((f) => (f === 'favorites' ? 'all' : 'favorites'))}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'favorites'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {filter === 'favorites' ? '⭐ Favoritos' : 'Todos'}
          </button>
        </div>
      </header>

      {/* Grid */}
      <main className="flex-1 overflow-y-auto pb-32">
        {visibleProducts.length === 0 ? (
          <div className="text-center py-12 px-6">
            {filter === 'favorites' && favoriteProducts.length === 0 ? (
              <>
                <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhum produto marcado como favorito do Modo Balada.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vá em <strong>Cardápio</strong> e marque os produtos que aparecem aqui.
                </p>
                <button
                  onClick={() => setFilter('all')}
                  className="mt-4 text-xs text-primary underline"
                >
                  Ver todos os produtos
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
            )}
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-2">
            {visibleProducts.map((p: any) => {
              const inCart = cart.find((c) => c.productId === p.id);
              const price = Number(p.promo_price || p.price);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`relative card-elevated p-3 text-left active:scale-95 transition-transform overflow-hidden ${
                    inCart ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {inCart && (
                    <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
                      {inCart.qty}
                    </span>
                  )}
                  <div className="aspect-square w-full rounded-lg bg-muted flex items-center justify-center mb-2 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl">🍻</span>
                    )}
                  </div>
                  <p className="font-medium text-sm leading-tight line-clamp-2">{p.name}</p>
                  <p className="font-bold text-primary text-sm mt-1">{fmt(price)}</p>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart bar */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowPay(true)}
          className="fixed bottom-4 left-4 right-4 z-30 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-between px-5 py-4 active:scale-95 transition-transform"
        >
          <div className="text-left">
            <p className="text-[10px] uppercase opacity-80">{cart.reduce((s, c) => s + c.qty, 0)} itens</p>
            <p className="font-bold text-lg">{fmt(subtotal)}</p>
          </div>
          <span className="font-bold uppercase tracking-wide text-sm">Cobrar →</span>
        </button>
      )}

      {/* Payment sheet */}
      {showPay && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={() => setShowPay(false)}>
          <div
            className="w-full bg-card rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Total a cobrar</p>
                <p className="font-heading font-bold text-3xl text-primary">{fmt(subtotal)}</p>
              </div>
              <button
                onClick={() => setShowPay(false)}
                className="p-2 rounded-lg hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {cart.map((it) => (
                <div key={it.productId} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(it.unitPrice)} cada</p>
                  </div>
                  <button onClick={() => updateQty(it.productId, -1)} className="h-7 w-7 rounded-md bg-background border border-border flex items-center justify-center">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm font-bold w-5 text-center">{it.qty}</span>
                  <button onClick={() => updateQty(it.productId, 1)} className="h-7 w-7 rounded-md bg-background border border-border flex items-center justify-center">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => removeItem(it.productId)} className="h-7 w-7 rounded-md text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Pulseira / Ficha (OBRIGATÓRIA — vincula retirada no bar) */}
            <div className={`rounded-xl border-2 p-3 mb-4 ${wristbandData ? 'border-success/50 bg-success/5' : 'border-dashed border-primary/40 bg-primary/5'}`}>
              <p className="text-xs uppercase text-primary font-bold mb-2 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Pulseira / Ficha <span className="text-destructive">*obrigatório</span>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={wristbandCode}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().slice(0, 12);
                      setWristbandCode(v);
                      setWristbandData(null);
                      setWristbandError(null);
                    }}
                    placeholder="DIGITE OU ESCANEIE"
                    className="w-full pl-7 pr-2 py-2 rounded-lg border border-border bg-background text-sm font-mono uppercase tracking-wider"
                  />
                </div>
                <QrScannerButton
                  onDetected={(code) => {
                    const c = code.toUpperCase().slice(0, 12);
                    setWristbandCode(c);
                    lookupWristband(c);
                  }}
                  className="rounded-lg bg-background border border-border px-3 py-2 hover:bg-muted"
                />
                <button
                  type="button"
                  disabled={!wristbandCode || checkingWb}
                  onClick={() => lookupWristband(wristbandCode)}
                  className="rounded-lg bg-primary text-primary-foreground px-3 text-xs font-bold disabled:opacity-50"
                >
                  {checkingWb ? '…' : 'OK'}
                </button>
              </div>
              {wristbandError && (
                <p className="text-[11px] text-destructive mt-1.5">{wristbandError}</p>
              )}
              {wristbandData && (
                <div className="mt-2 rounded-lg bg-background p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold tracking-wider">✓ {wristbandData.code}</span>
                    {wristbandData.tier === 'vip' && (
                      <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded">VIP</span>
                    )}
                  </div>
                  {wristbandData.customer_name && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{wristbandData.customer_name}</p>
                  )}
                  <p className="text-[11px] text-success mt-1">
                    Pedido vai para o Painel do Bar com essa pulseira
                  </p>
                </div>
              )}
              {!wristbandData && !wristbandError && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Toda venda no Modo Balada precisa estar vinculada a uma pulseira para retirada no bar.
                </p>
              )}
            </div>

            <p className="text-xs uppercase text-muted-foreground mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.key}
                  disabled={paying || !wristbandData}
                  onClick={() => handleCharge(opt.key)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-4 text-white font-bold ${opt.color} active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <opt.icon className="h-6 w-6" />
                  <span className="text-sm">{opt.label}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-center text-muted-foreground mt-4">
              {online ? 'Conectado — venda registrada na hora' : '⚠ Offline — será salva e sincronizada depois'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
