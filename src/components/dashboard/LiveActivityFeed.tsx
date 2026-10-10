import { useMemo } from 'react';
import { ShoppingBag, CheckCircle, Bell, XCircle, Clock } from 'lucide-react';

interface Props {
  orders: Array<{ id: string; number?: number | string; customer_name?: string; status: string; type?: string; created_at: string; total?: number | string }>;
  calls?: Array<{ id: string; type: string; status: string; created_at: string; restaurant_tables?: any }>;
  limit?: number;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function LiveActivityFeed({ orders, calls = [], limit = 8 }: Props) {
  const items = useMemo(() => {
    const events: Array<{ id: string; ts: number; icon: any; color: string; title: string; sub: string }> = [];
    orders.forEach(o => {
      const ts = new Date(o.created_at).getTime();
      if (o.status === 'cancelled') {
        events.push({ id: `o-c-${o.id}`, ts, icon: XCircle, color: 'text-destructive', title: `Pedido #${o.number} cancelado`, sub: o.customer_name || '—' });
      } else if (o.status === 'completed') {
        events.push({ id: `o-d-${o.id}`, ts, icon: CheckCircle, color: 'text-success', title: `#${o.number} concluído`, sub: `${o.customer_name || '—'} · R$ ${Number(o.total || 0).toFixed(2)}` });
      } else {
        events.push({ id: `o-n-${o.id}`, ts, icon: ShoppingBag, color: 'text-primary', title: `Novo pedido #${o.number}`, sub: `${o.customer_name || '—'} · ${o.type || ''}` });
      }
    });
    calls.forEach(c => {
      events.push({
        id: `c-${c.id}`,
        ts: new Date(c.created_at).getTime(),
        icon: Bell,
        color: 'text-warning',
        title: c.type === 'request_bill' ? 'Pedido de conta' : 'Garçom chamado',
        sub: (c.restaurant_tables as any)?.label || `Mesa ${(c.restaurant_tables as any)?.number || '?'}`,
      });
    });
    return events.sort((a, b) => b.ts - a.ts).slice(0, limit);
  }, [orders, calls, limit]);

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <p className="text-xs font-heading font-black">Atividade ao vivo</p>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{items.length} eventos</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center flex items-center justify-center gap-1.5">
          <Clock className="h-3 w-3" /> Aguardando atividade…
        </p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {items.map(e => (
            <li key={e.id} className="flex items-start gap-2.5 text-xs animate-fade-in">
              <e.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${e.color}`} />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight truncate">{e.title}</p>
                <p className="text-muted-foreground text-[11px] truncate">{e.sub}</p>
              </div>
              <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">{timeAgo(new Date(e.ts).toISOString())}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
