import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Sparkline from './Sparkline';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  spark?: number[];
  /** Percentage change vs previous period; positive = up */
  delta?: number | null;
  deltaLabel?: string;
  /** Optional progress 0-100 (e.g. revenue vs goal) */
  progress?: number;
  progressLabel?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'accent';
}

const accentMap: Record<NonNullable<Props['accent']>, { ring: string; text: string; bg: string; spark: string }> = {
  primary: { ring: 'ring-primary/20', text: 'text-primary', bg: 'from-primary/15 to-primary/5', spark: 'hsl(var(--primary))' },
  success: { ring: 'ring-success/20', text: 'text-success', bg: 'from-success/15 to-success/5', spark: 'hsl(var(--success))' },
  warning: { ring: 'ring-warning/20', text: 'text-warning', bg: 'from-warning/15 to-warning/5', spark: 'hsl(var(--warning))' },
  destructive: { ring: 'ring-destructive/20', text: 'text-destructive', bg: 'from-destructive/15 to-destructive/5', spark: 'hsl(var(--destructive))' },
  accent: { ring: 'ring-accent/20', text: 'text-accent', bg: 'from-accent/15 to-accent/5', spark: 'hsl(var(--accent))' },
};

export default function MetricCardPremium({
  label,
  value,
  icon: Icon,
  spark,
  delta = null,
  deltaLabel = 'vs ontem',
  progress,
  progressLabel,
  accent = 'primary',
}: Props) {
  const a = accentMap[accent];
  const deltaPositive = (delta ?? 0) > 0;
  const deltaNegative = (delta ?? 0) < 0;
  const TrendIcon = deltaPositive ? TrendingUp : deltaNegative ? TrendingDown : Minus;
  const trendBg = deltaPositive
    ? 'bg-success/10 text-success ring-success/20'
    : deltaNegative
    ? 'bg-destructive/10 text-destructive ring-destructive/20'
    : 'bg-muted text-muted-foreground ring-border';

  return (
    <div className="metric-tile group">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{label}</p>
          <p className="text-2xl sm:text-[26px] font-heading font-black tracking-tight leading-none truncate">{value}</p>
          {delta !== null && (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-black ring-1 ${trendBg}`}>
              <TrendIcon className="h-2.5 w-2.5" />
              {Math.abs(delta).toFixed(0)}% <span className="font-medium opacity-70">{deltaLabel}</span>
            </span>
          )}
        </div>
        <div
          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${a.bg} ring-1 ${a.ring} ${a.text} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-200`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {spark && spark.length > 1 && (
        <div className="mt-2 -mx-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <Sparkline data={spark} color={a.spark} width={140} height={28} />
        </div>
      )}

      {typeof progress === 'number' && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="font-bold text-muted-foreground">{progressLabel || 'Meta'}</span>
            <span className={`font-black tabular-nums ${a.text}`}>{Math.min(100, Math.round(progress))}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${
                accent === 'primary' ? 'from-primary to-primary-glow' :
                accent === 'success' ? 'from-success to-success/70' :
                accent === 'warning' ? 'from-warning to-warning/70' :
                accent === 'destructive' ? 'from-destructive to-destructive/70' :
                'from-accent to-accent/70'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
