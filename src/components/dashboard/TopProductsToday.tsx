import { Flame, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  orders: Array<{ status: string; order_items?: Array<{ name?: string; qty?: number; product_id?: string; price?: number | string }> }>;
}

export default function TopProductsToday({ orders }: Props) {
  const top = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      (o.order_items || []).forEach(it => {
        const name = it.name || '—';
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const cur = map.get(name) || { name, qty: 0, revenue: 0 };
        cur.qty += qty;
        cur.revenue += qty * price;
        map.set(name, cur);
      });
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  const max = Math.max(...top.map(t => t.qty), 1);

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-primary">
          <Flame className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Bombando hoje</p>
          <p className="text-xs font-heading font-black mt-0.5">Top 5 mais vendidos</p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Sem vendas registradas ainda hoje.</p>
      ) : (
        <div className="space-y-2">
          {top.map((p, i) => {
            const pct = (p.qty / max) * 100;
            return (
              <div key={p.name} className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                      i === 0 ? 'bg-primary text-primary-foreground' : i === 1 ? 'bg-accent/80 text-accent-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="font-bold truncate">{p.name}</span>
                  </div>
                  <span className="font-bold tabular-nums shrink-0 ml-2">{p.qty}x</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500 group-hover:from-primary-glow group-hover:to-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
