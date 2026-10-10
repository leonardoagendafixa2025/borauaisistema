import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
}

export default function MetricCard({ label, value, change, changeType = 'neutral', icon: Icon, iconColor }: Props) {
  const trendColor =
    changeType === 'positive'
      ? 'bg-success/10 text-success ring-success/20'
      : changeType === 'negative'
      ? 'bg-destructive/10 text-destructive ring-destructive/20'
      : 'bg-muted text-muted-foreground ring-border';
  const TrendIcon = changeType === 'positive' ? TrendingUp : changeType === 'negative' ? TrendingDown : null;

  return (
    <div className="metric-tile group">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{label}</p>
          <p className="text-2xl sm:text-[26px] font-heading font-black tracking-tight leading-none">{value}</p>
          {change && (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${trendColor}`}>
              {TrendIcon && <TrendIcon className="h-3 w-3" />}
              {change}
            </span>
          )}
        </div>
        <div
          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20 ${iconColor || 'text-primary'} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-200`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
