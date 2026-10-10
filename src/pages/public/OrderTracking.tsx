import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, ChefHat, Truck, Package, XCircle, ArrowLeft, Hourglass, User, Star } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { supabase } from '@/integrations/supabase/client';
import CustomerDeliveryMap from '@/components/CustomerDeliveryMap';
import RatingDialog from '@/components/RatingDialog';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STEPS_DELIVERY = [
  { key: 'new', label: 'Pedido recebido', icon: Clock },
  { key: 'accepted', label: 'Aceito', icon: CheckCircle },
  { key: 'preparing', label: 'Em preparo', icon: ChefHat },
  { key: 'ready', label: 'Pronto', icon: Package },
  { key: 'delivering', label: 'Saiu p/ entrega', icon: Truck },
  { key: 'completed', label: 'Concluído', icon: CheckCircle },
];

const STEPS_PICKUP = [
  { key: 'new', label: 'Pedido recebido', icon: Clock },
  { key: 'accepted', label: 'Aceito', icon: CheckCircle },
  { key: 'preparing', label: 'Em preparo', icon: ChefHat },
  { key: 'waiting_pickup', label: 'Aguardando retirada', icon: Hourglass },
  { key: 'completed', label: 'Concluído', icon: CheckCircle },
];

const STEPS_DINEIN = [
  { key: 'new', label: 'Pedido recebido', icon: Clock },
  { key: 'accepted', label: 'Aceito', icon: CheckCircle },
  { key: 'preparing', label: 'Em preparo', icon: ChefHat },
  { key: 'ready', label: 'Pronto', icon: Package },
  { key: 'completed', label: 'Concluído', icon: CheckCircle },
];

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  const refreshRatingStatus = async () => {
    if (!orderId) return false;
    const { data } = await (publicSupabase as any)
      .rpc('get_order_rating_status', { _order_id: orderId });
    const status = Array.isArray(data) ? data[0] : data;
    const done = !!status?.restaurant_done && status?.driver_done !== false;
    if (status) setAlreadyRated(done);
    return done;
  };

  useEffect(() => {
    if (!orderId) return;
    refreshRatingStatus();
  }, [orderId, ratingOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsAuthed(!!session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsAuthed(!!s?.user));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const fetchOrder = async () => {
      // Usa RPC segura (não expõe PII de outros pedidos)
      const { data: rpcData } = await (publicSupabase as any).rpc('get_order_for_tracking', { _order_id: orderId });
      const o = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (o) {
        setOrder(o);
        setItems(o.items || []);
        // Busca slug do restaurante e número da mesa via consultas específicas
        if (o.restaurant_id) {
          const { data: r } = await (publicSupabase as any).from('restaurants_public').select('slug').eq('id', o.restaurant_id).maybeSingle();
          setRestaurantSlug(r?.slug || null);
        }
        if (o.table_id) {
          const { data: t } = await publicSupabase.from('restaurant_tables').select('number').eq('id', o.table_id).maybeSingle();
          setTableNumber(t?.number ?? null);
        }
      }
      setLoading(false);
    };
    fetchOrder();

    // Realtime: ao receber update, refaz a busca via RPC (que tem permissão)
    const channel = publicSupabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, async () => {
        const { data: rpcData } = await (publicSupabase as any).rpc('get_order_for_tracking', { _order_id: orderId });
        const o = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (o) {
          setOrder(o);
          setItems(o.items || []);
        }
      })
      .subscribe();

    return () => { publicSupabase.removeChannel(channel); };
  }, [orderId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Pedido não encontrado</p></div>;
  }

  const isCancelled = order.status === 'cancelled';
  const steps = order.type === 'pickup' ? STEPS_PICKUP : order.type === 'dine_in' ? STEPS_DINEIN : STEPS_DELIVERY;
  const currentStepIdx = steps.findIndex(s => s.key === order.status);
  const typeLabels: Record<string, string> = { delivery: 'Delivery', pickup: 'Retirada', dine_in: 'Mesa' };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background font-public">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {(() => {
          const isDineIn = order.type === 'dine_in';
          const dineInUrl = isDineIn && restaurantSlug && tableNumber != null ? `/${restaurantSlug}/mesa/${tableNumber}` : null;
          const backUrl = dineInUrl || (restaurantSlug ? `/${restaurantSlug}` : (isAuthed ? '/cliente' : '/'));
          return (
            <div className="flex items-center gap-3">
              <Link to={backUrl} className="icon-pill" aria-label="Voltar">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="font-heading font-bold text-xl">Pedido #{order.number}</h1>
                <p className="text-sm text-muted-foreground">{typeLabels[order.type] || order.type} · {new Date(order.created_at).toLocaleString('pt-BR')}</p>
              </div>
              {isDineIn ? (
                dineInUrl && (
                  <Link to={dineInUrl} className="hidden sm:inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                    Voltar à mesa
                  </Link>
                )
              ) : isAuthed ? (
                <Link to="/cliente" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                  <User className="h-4 w-4" /> Minha conta
                </Link>
              ) : (
                <Link to="/cliente/login" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                  <User className="h-4 w-4" /> Entrar
                </Link>
              )}
            </div>
          );
        })()}

        {isCancelled ? (
          <div className="card-elevated p-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h2 className="font-heading font-bold text-lg">Pedido cancelado</h2>
            <p className="text-sm text-muted-foreground mt-1">Este pedido foi cancelado.</p>
          </div>
        ) : (
          <div className="card-elevated p-5">
            <h2 className="font-heading font-semibold mb-4">Acompanhamento</h2>
            <div className="space-y-4">
              {steps.map((step, i) => {
                const isComplete = i <= currentStepIdx;
                const isCurrent = i === currentStepIdx;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      isComplete ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                    } ${isCurrent ? 'ring-2 ring-success ring-offset-2 ring-offset-background' : ''}`}>
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className={`text-sm ${isComplete ? 'font-medium' : 'text-muted-foreground'}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {order.type === 'dine_in' && restaurantSlug && tableNumber != null && (
          <div className="card-elevated p-4 space-y-2">
            <Link
              to={`/${restaurantSlug}/mesa/${tableNumber}`}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              ➕ Fazer novo pedido na Mesa {tableNumber}
            </Link>
            <Link
              to={`/${restaurantSlug}/mesa/${tableNumber}/conta`}
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              📋 Ver todos os pedidos da Mesa {tableNumber}
            </Link>
          </div>
        )}

        {!isCancelled && order.type === 'delivery' && order.status === 'delivering' && orderId && (
          <CustomerDeliveryMap orderId={orderId} />
        )}

        {order.status === 'completed' && orderId && !alreadyRated && (
          <div className="card-elevated p-5 text-center space-y-3 border-2 border-primary/30">
            <div className="text-4xl">⭐</div>
            <div>
              <h3 className="font-heading font-bold">Como foi sua experiência?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sua avaliação ajuda o restaurante {order.type === 'delivery' && order.driver_id ? 'e o entregador ' : ''}a melhorar.
              </p>
            </div>
            <button
              onClick={async () => {
                const done = await refreshRatingStatus();
                if (!done) setRatingOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Star className="h-4 w-4" /> Avaliar pedido
            </button>
          </div>
        )}

        {order.status === 'completed' && alreadyRated && (
          <div className="card-elevated p-4 text-center text-sm text-muted-foreground border border-success/30 bg-success/5">
            ⭐ Você já avaliou este pedido. Obrigado pelo feedback!
          </div>
        )}

        {orderId && <RatingDialog orderId={orderId} open={ratingOpen} onSubmitted={() => setAlreadyRated(true)} onClose={() => setRatingOpen(false)} />}

        <div className="card-elevated p-5">
          <h3 className="font-heading font-semibold mb-3">Itens do pedido</h3>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id}>
                <div className="flex justify-between text-sm">
                  <span>{item.qty}x {item.name}</span>
                  <span className="font-medium tabular-nums">{fmt(Number(item.total_price))}</span>
                </div>
                {item.options && Array.isArray(item.options) && item.options.length > 0 && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {item.options.map((opt: any, oi: number) => (
                      <p key={oi} className="text-xs text-muted-foreground">
                        + {opt.name}{opt.price > 0 ? ` (${fmt(opt.price)})` : ''}
                      </p>
                    ))}
                  </div>
                )}
                {item.notes && <p className="text-xs text-muted-foreground ml-4 italic mt-0.5">→ {item.notes}</p>}
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span><span>{fmt(Number(order.subtotal))}</span>
            </div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Entrega</span><span>{fmt(Number(order.delivery_fee))}</span>
              </div>
            )}
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Desconto</span><span>-{fmt(Number(order.discount))}</span>
              </div>
            )}
            <div className="flex justify-between font-heading font-bold pt-1 border-t border-border">
              <span>Total</span><span>{fmt(Number(order.total))}</span>
            </div>
            {!isCancelled && order.payment_status !== 'paid' && (
              <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-[11px] text-warning-foreground leading-relaxed">
                💵 <strong>Pagamento direto ao estabelecimento</strong> {order.payment_method ? `via ${order.payment_method.replace('_', ' ')}` : ''} {order.type === 'delivery' ? 'na entrega' : order.type === 'pickup' ? 'na retirada' : ''}. A plataforma não processa cobranças.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
