import { useMemo } from 'react';

interface Props {
  orders: Array<{ created_at: string; status: string; total: number | string }>;
  currentHour?: number;
}

/**
 * Horizontal bar showing order volume per hour of the current day (0-23).
 * Highlights current hour, peak hour, and total orders.
 */
export default function HourlyPulse({ orders, currentHour = new Date().getHours() }: Props) {
  const buckets = useMemo(() => {
    const arr = Array(24).fill(0);
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      arr[h]++;
    });
    return arr;
  }, [orders]);

  const max = Math.max(...buckets, 1);
  const peakHour = buckets.indexOf(max);
  const total = buckets.reduce((s, n) => s + n, 0);

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ritmo do dia</p>
          <p className="text-sm font-heading font-black mt-0.5">
            {total} pedidos • pico {String(peakHour).padStart(2, '0')}h
            <span className="text-muted-foreground font-medium"> ({max})</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-primary" /> Agora
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-primary/30" /> Atividade
          </span>
        </div>
      </div>
      <div className="flex items-end gap-[2px] h-16">
        {buckets.map((count, h) => {
          const ratio = count / max;
          const isCurrent = h === currentHour;
          const isPeak = h === peakHour && count > 0;
          return (
            <div key={h} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                className={`w-full rounded-t-sm transition-all duration-300 ${
                  isCurrent
                    ? 'bg-gradient-to-t from-primary to-primary-glow ring-2 ring-primary/40 shadow-lg shadow-primary/30'
                    : count > 0
                    ? 'bg-primary/30 group-hover:bg-primary/60'
                    : 'bg-muted/40'
                } ${isPeak && !isCurrent ? 'ring-1 ring-accent/40' : ''}`}
                style={{ height: `${Math.max(ratio * 100, count > 0 ? 8 : 4)}%` }}
                title={`${String(h).padStart(2, '0')}h: ${count} pedido${count !== 1 ? 's' : ''}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground/70 font-mono tabular-nums">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}
