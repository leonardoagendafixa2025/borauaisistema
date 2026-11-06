import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, Clock, ChevronRight, Package, Truck, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabels: Record<string, { label: string; class: string }> = {
  new: { label: 'Novo', class: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Aceito', class: 'bg-sky-100 text-sky-700' },
  preparing: { label: 'Em preparo', class: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Pronto', class: 'bg-emerald-100 text-emerald-700' },
  delivering: { label: 'Em entrega', class: 'bg-purple-100 text-purple-700' },
  waiting_pickup: { label: 'Aguardando retirada', class: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Concluído', class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', class: 'bg-red-100 text-red-700' },
};

const typeIcons: Record<string, typeof Truck> = {
  delivery: Truck,
  pickup: ShoppingBag,
  dine_in: UtensilsCrossed,
};

const formatPhone = (val: string) => {
  const raw = val.replace(/\D/g, '').slice(0, 11);
  if (raw.length <= 2) return raw;
  if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
};

export default function OrderHistory() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const stateSlug = (location.state as any)?.fromSlug as string | undefined;
  const paramSlug = searchParams.get('slug') || undefined;

  const [fromSlug, setFromSlug] = useState<string | undefined>(() => {
    return stateSlug || paramSlug || sessionStorage.getItem('lastRestaurantSlug') || localStorage.getItem('borauai_last_slug') || undefined;
  });

  const [lastOrderId] = useState<string | null>(() => {
    return localStorage.getItem('borauai_last_order_id') || null;
  });
  const [lastOrderDetails, setLastOrderDetails] = useState<any | null>(null);

  useEffect(() => {
    const slug = stateSlug || paramSlug;
    if (slug) {
      sessionStorage.setItem('lastRestaurantSlug', slug);
      setFromSlug(slug);
    }
  }, [stateSlug, paramSlug]);

  useEffect(() => {
    const savedPhone = localStorage.getItem('borauai_last_phone');
    if (savedPhone) {
      setPhone(formatPhone(savedPhone));
    }

    if (lastOrderId) {
      (publicSupabase as any)
        .rpc('get_order_for_tracking', { _order_id: lastOrderId })
        .then(({ data }: any) => {
          const orderData = Array.isArray(data) ? data[0] : data;
          if (orderData && orderData.id) {
            setLastOrderDetails(orderData);
          }
        })
        .catch(() => {});
    }
  }, [lastOrderId]);

  const backUrl = fromSlug ? `/${fromSlug}` : '/';

  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'phone' | 'number'>('phone');

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);

    if (searchMode === 'number') {
      const num = parseInt(orderNumber.replace(/\D/g, ''), 10);
      if (isNaN(num)) { setOrders([]); setLoading(false); return; }
      const { data: { user } } = await publicSupabase.auth.getUser();
      if (user) {
        const { data } = await publicSupabase
          .from('orders')
          .select('*, order_items(*), restaurants(name, slug, logo_url)')
          .eq('number', num)
          .order('created_at', { ascending: false })
          .limit(10);
        setOrders(data || []);
      } else {
        if (lastOrderDetails && Number(lastOrderDetails.number) === num) {
          setOrders([lastOrderDetails]);
        } else {
          setOrders([]);
        }
      }
    } else {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length < 8) { setOrders([]); setLoading(false); return; }

      const { data: { user } } = await publicSupabase.auth.getUser();
      if (user) {
        const { data } = await publicSupabase
          .from('orders')
          .select('*, order_items(*), restaurants(name, slug, logo_url)')
          .order('created_at', { ascending: false })
          .limit(50);
        setOrders(data || []);
      } else {
        const candidateSlug =
          fromSlug ||
          searchParams.get('slug') ||
          sessionStorage.getItem('lastRestaurantSlug') ||
          localStorage.getItem('borauai_last_slug');

        let restId = localStorage.getItem('borauai_last_restaurant_id');
        let restInfo: any = null;

        if (candidateSlug) {
          const { data: rest } = await publicSupabase
            .from('restaurants')
            .select('id, name, slug, logo_url')
            .eq('slug', candidateSlug)
            .maybeSingle();
          if (rest) {
            restId = rest.id;
            restInfo = rest;
          }
        }

        if (restId) {
          const { data: phoneOrders } = await (publicSupabase as any).rpc('find_orders_by_phone', {
            _restaurant_id: restId,
            _phone: cleaned,
          });

          if (phoneOrders && phoneOrders.length > 0) {
            setOrders(phoneOrders.map((o: any) => ({
              ...o,
              restaurants: restInfo || (fromSlug ? { name: fromSlug, slug: fromSlug } : undefined),
            })));
          } else if (lastOrderDetails && lastOrderDetails.customer_phone?.replace(/\D/g, '') === cleaned) {
            setOrders([lastOrderDetails]);
          } else {
            setOrders([]);
          }
        } else if (lastOrderDetails && lastOrderDetails.customer_phone?.replace(/\D/g, '') === cleaned) {
          setOrders([lastOrderDetails]);
        } else {
          setOrders([]);
        }
      }
    }
    setLoading(false);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    if (date.toDateString() === yesterday.toDateString()) return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background font-public">
      {/* Sticky glass header */}
      <header className="public-header">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to={backUrl} className="icon-pill" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight">Meus Pedidos</h1>
            <p className="text-[11px] text-muted-foreground">Acompanhe seu histórico</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Quick link to recent order on this device */}
        {lastOrderDetails && (
          <div className="card-premium p-4 mb-5 bg-primary/5 border border-primary/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Pedido recente neste aparelho</p>
                <p className="text-xs text-muted-foreground truncate">
                  Pedido #{lastOrderDetails.number} · {statusLabels[lastOrderDetails.status]?.label || lastOrderDetails.status}
                </p>
              </div>
            </div>
            <Link
              to={`/pedido/${lastOrderDetails.id}`}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0 transition-all active:scale-95"
            >
              Acompanhar
            </Link>
          </div>
        )}

        {/* Hero card with search */}
        <div className="card-premium p-5 mb-6 bg-gradient-to-br from-card to-primary/5">
          <h2 className="font-bold text-base mb-1">Buscar meus pedidos</h2>
          <p className="text-xs text-muted-foreground mb-4">Encontre pelo WhatsApp cadastrado ou nº do pedido</p>

          <div className="flex gap-1.5 mb-3 p-1 bg-muted/60 rounded-full">
            <button onClick={() => setSearchMode('phone')}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${searchMode === 'phone' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
              📱 Telefone
            </button>
            <button onClick={() => setSearchMode('number')}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${searchMode === 'number' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
              # Nº do pedido
            </button>
          </div>

          <div className="space-y-2">
            {searchMode === 'phone' ? (
              <input
                type="tel"
                placeholder="(31) 99999-9999"
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                maxLength={15}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              />
            ) : (
              <input
                type="text"
                placeholder="Ex: 1234"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              />
            )}
            <button
              onClick={handleSearch}
              disabled={(searchMode === 'phone' ? phone.replace(/\D/g, '').length < 8 : !orderNumber.trim()) || loading}
              className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-tinted-sm"
            >
              <Search className="h-4 w-4" />
              Buscar pedidos
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {searched && !loading && orders.length === 0 && (
          <div className="text-center py-12 card-premium">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <p className="font-bold text-base">Nenhum pedido recente encontrado</p>
            <p className="text-sm text-muted-foreground mt-1 px-6 max-w-sm mx-auto">
              {searchMode === 'phone'
                ? 'Verifique o DDD e os números informados. Pedidos anônimos ficam disponíveis por até 7 dias.'
                : 'Não encontramos pedidos com este número para o seu login.'}
            </p>
            {fromSlug && (
              <Link to={backUrl} className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-primary hover:underline">
                ← Voltar ao cardápio
              </Link>
            )}
          </div>
        )}

        {orders.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {orders.length} pedido{orders.length > 1 ? 's' : ''} encontrado{orders.length > 1 ? 's' : ''}
            </p>
            {orders.map(order => {
              const status = statusLabels[order.status] || { label: order.status, class: 'bg-muted text-muted-foreground' };
              const TypeIcon = typeIcons[order.type] || Package;
              const restaurant = order.restaurants;
              const itemsSummary = (order.order_items || []).slice(0, 3).map((i: any) => `${i.qty}x ${i.name}`).join(', ');
              const remaining = (order.order_items || []).length - 3;

              return (
                <Link
                  key={order.id}
                  to={`/pedido/${order.id}`}
                  className="card-premium card-premium-hover p-4 flex gap-3 block"
                >
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                    <TypeIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-sm">#{order.number}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.class}`}>{status.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    {restaurant && (
                      <p className="text-xs font-semibold text-foreground/80 mt-0.5 truncate">{restaurant.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {itemsSummary}{remaining > 0 ? ` +${remaining}` : ''}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(order.created_at)}
                      </span>
                      <span className="font-bold text-sm text-primary">{fmt(Number(order.total))}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
