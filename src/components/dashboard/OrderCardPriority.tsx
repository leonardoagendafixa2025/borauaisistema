import { Phone, Printer, Truck, Store, UtensilsCrossed, Zap, MapPin, Clock, AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import OrderTicket from '@/components/OrderTicket';

const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const statusLabels: Record<string, { label: string; class: string }> = {
  new: { label: 'Novo', class: 'bg-primary/10 text-primary' },
  accepted: { label: 'Aceito', class: 'bg-blue-500/10 text-blue-600' },
  preparing: { label: 'Preparando', class: 'bg-warning/10 text-warning' },
  ready: { label: 'Pronto', class: 'bg-success/10 text-success' },
  delivering: { label: 'Entregando', class: 'bg-accent/10 text-accent' },
  waiting_pickup: { label: 'Aguardando retirada', class: 'bg-accent/10 text-accent' },
  completed: { label: 'Concluído', class: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', class: 'bg-destructive/10 text-destructive' },
};

const typeMeta: Record<string, { icon: any; label: string; tint: string }> = {
  delivery: { icon: Truck, label: 'Delivery', tint: 'bg-primary/10 text-primary ring-primary/20' },
  pickup: { icon: Store, label: 'Retirada', tint: 'bg-accent/10 text-accent ring-accent/20' },
  dine_in: { icon: UtensilsCrossed, label: 'Mesa', tint: 'bg-warning/10 text-warning ring-warning/20' },
  quick_sale: { icon: Zap, label: 'Balada', tint: 'bg-success/10 text-success ring-success/20' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

/**
 * Returns urgency level based on minutes since creation.
 * new orders escalate fast; in-progress orders escalate slower.
 */
function urgency(dateStr: string, status: string): 'fresh' | 'warm' | 'hot' | 'critical' {
  const mins = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (status === 'new') {
    if (mins > 5) return 'critical';
    if (mins > 2) return 'hot';
    if (mins > 1) return 'warm';
    return 'fresh';
  }
  if (mins > 30) return 'critical';
  if (mins > 15) return 'hot';
  if (mins > 8) return 'warm';
  return 'fresh';
}

const urgencyClasses: Record<string, { ring: string; bar: string; pulse: boolean }> = {
  fresh: { ring: 'ring-border/60', bar: 'bg-success', pulse: false },
  warm: { ring: 'ring-warning/30', bar: 'bg-warning', pulse: false },
  hot: { ring: 'ring-warning/60 shadow-warning/10', bar: 'bg-gradient-to-r from-warning to-destructive', pulse: false },
  critical: { ring: 'ring-destructive/60 shadow-destructive/20', bar: 'bg-destructive', pulse: true },
};

interface Props {
  order: any;
  onAction?: () => void;
  actionLabel: string;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  showDeliveryAction?: boolean;
}

export default function OrderCardPriority({ order, onAction, actionLabel, onComplete, onCancel, showDeliveryAction }: Props) {
  const [showTicket, setShowTicket] = useState(false);
  const [, force] = useState(0);

  // Tick every 30s so urgency updates live
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const s = statusLabels[order.status] || statusLabels.new;
  const items = order.order_items || [];
  const tableInfo = order.restaurant_tables;
  const tableLabel = tableInfo?.label || (tableInfo?.number ? `Mesa ${tableInfo.number}` : undefined);
  const tm = typeMeta[order.type] || typeMeta.delivery;
  const u = urgency(order.created_at, order.status);
  const uc = urgencyClasses[u];

  return (
    <>
      <div className={`relative overflow-hidden bg-card rounded-2xl ring-1 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${uc.ring}`}>
        {/* Urgency side bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${uc.bar} ${uc.pulse ? 'animate-pulse' : ''}`} aria-hidden />

        <div className="p-4 pl-5">
          <div className="flex items-start gap-3">
            {/* Big modality icon */}
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ring-1 ${tm.tint}`}>
              <tm.icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-black text-lg leading-none">#{order.number}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${s.class}`}>{s.label}</span>
                {tableLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-bold ring-1 ring-warning/20">
                    <UtensilsCrossed className="h-2.5 w-2.5" /> {tableLabel}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                  u === 'critical' ? 'text-destructive' : u === 'hot' ? 'text-warning' : 'text-muted-foreground'
                }`}>
                  {u === 'critical' && <AlertTriangle className="h-3 w-3" />}
                  <Clock className="h-2.5 w-2.5" />
                  {timeAgo(order.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-sm font-bold truncate">{order.customer_name}</p>
                {order.customer_phone && (
                  <a
                    href={`https://wa.me/${order.customer_phone.replace(/\D/g, '').replace(/^0+/, '').replace(/^(?!55)/, '55')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-success hover:text-success/80"
                    title="WhatsApp"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <div className="mt-2 space-y-0.5">
                {items.slice(0, 3).map((item: any, idx: number) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground tabular-nums">{item.qty}×</span> {item.name}
                    {item.notes && <span className="italic ml-1 text-warning">({item.notes})</span>}
                  </p>
                ))}
                {items.length > 3 && (
                  <p className="text-[10px] text-muted-foreground/70 italic">+{items.length - 3} item(ns)…</p>
                )}
              </div>

              {order.notes && (
                <p className="text-xs italic text-warning mt-1.5 bg-warning/5 rounded px-2 py-1 ring-1 ring-warning/15">📝 {order.notes}</p>
              )}
              {order.address && order.type === 'delivery' && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> <span className="line-clamp-1">{order.address}</span>
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="font-heading font-black tabular-nums text-xl leading-none">{formatCurrency(Number(order.total))}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">{order.payment_method || '—'}</p>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
            <button
              onClick={() => setShowTicket(true)}
              className="px-2.5 py-2 text-xs font-bold rounded-xl ring-1 ring-border hover:bg-muted transition-colors flex items-center gap-1"
              title="Imprimir comanda"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>

            {showDeliveryAction && (
              <a
                href="/restaurant/orders"
                className="flex-1 px-3 py-2 text-center text-xs font-black uppercase tracking-wide rounded-xl bg-accent text-accent-foreground hover:brightness-110 transition-all"
              >
                🛵 Enviar p/ Entregador
              </a>
            )}

            {onAction && (
              <button
                onClick={onAction}
                className={`flex-1 px-3 py-2.5 text-sm font-black uppercase tracking-wide rounded-xl text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  u === 'critical'
                    ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/30 animate-pulse'
                    : u === 'hot'
                    ? 'bg-gradient-to-r from-warning to-destructive hover:brightness-110 shadow-warning/20'
                    : 'bg-gradient-to-r from-primary to-primary-glow hover:brightness-110 shadow-primary/20'
                }`}
              >
                {actionLabel}
              </button>
            )}

            {!['new', 'completed', 'cancelled'].includes(order.status) && order.type !== 'delivery' && (
              <button
                onClick={() => onComplete(order.id)}
                className="px-2.5 py-2 text-xs font-bold rounded-xl ring-1 ring-success/40 text-success hover:bg-success/10 transition-colors"
                title="Concluir"
              >
                ✓
              </button>
            )}

            {!['completed', 'cancelled'].includes(order.status) && (
              <button
                onClick={() => onCancel(order.id)}
                className="px-2.5 py-2 text-xs font-bold rounded-xl ring-1 ring-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                title="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showTicket && (
        <OrderTicket
          order={{ ...order, order_items: items }}
          tableLabel={tableLabel}
          onClose={() => setShowTicket(false)}
        />
      )}
    </>
  );
}
