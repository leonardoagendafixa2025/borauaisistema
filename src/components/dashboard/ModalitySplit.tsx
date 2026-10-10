import { Truck, Store, UtensilsCrossed, Zap } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  orders: Array<{ type: string; total: number | string; status: string }>;
}

const MOD = [
  { key: 'delivery', label: 'Delivery', icon: Truck, color: 'hsl(var(--primary))' },
  { key: 'pickup', label: 'Retirada', icon: Store, color: 'hsl(var(--accent))' },
  { key: 'dine_in', label: 'Mesa', icon: UtensilsCrossed, color: 'hsl(var(--warning))' },
  { key: 'quick_sale', label: 'Balada', icon: Zap, color: 'hsl(var(--success))' },
] as const;

export default function ModalitySplit({ orders }: Props) {
  const stats = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {};
    MOD.forEach(m => (counts[m.key] = { count: 0, revenue: 0 }));
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const k = o.type as keyof typeof counts;
      if (counts[k]) {
        counts[k].count++;
        counts[k].revenue += Number(o.total);
      }
    });
    const total = Object.values(counts).reduce((s, c) => s + c.count, 0);
    return { counts, total };
  }, [orders]);

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mix de canais</p>
        <p className="text-xs font-bold tabular-nums text-muted-foreground">{stats.total} totais</p>
      </div>

      {/* Stacked horizontal bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-muted/40 ring-1 ring-border/60 mb-3">
        {stats.total > 0 ? MOD.map(m => {
          const pct = (stats.counts[m.key].count / stats.total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={m.key}
              className="transition-all duration-500 hover:brightness-110"
              style={{ width: `${pct}%`, background: m.color }}
              title={`${m.label}: ${stats.counts[m.key].count} (${pct.toFixed(0)}%)`}
            />
          );
        }) : (
          <div className="w-full bg-muted/40" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {MOD.map(m => {
          const data = stats.counts[m.key];
          const pct = stats.total > 0 ? (data.count / stats.total) * 100 : 0;
          return (
            <div key={m.key} className="flex items-center gap-2 rounded-xl ring-1 ring-border/60 px-2.5 py-2 bg-muted/20">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${m.color}1a`, color: m.color }}
              >
                <m.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground/80 leading-none">{m.label}</p>
                <p className="text-sm font-heading font-black tabular-nums leading-tight mt-0.5">
                  {data.count}
                  <span className="text-[10px] font-medium text-muted-foreground ml-1">{pct.toFixed(0)}%</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
