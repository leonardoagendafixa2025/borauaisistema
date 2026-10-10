import { Link } from 'react-router-dom';
import { UtensilsCrossed, ChefHat, Music, Package, Truck, Bell, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { useLiveOps } from '@/hooks/useLiveOps';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

type Tone = 'primary' | 'success' | 'warning' | 'destructive' | 'accent' | 'muted';

interface LiveTileProps {
  to: string;
  icon: LucideIcon;
  label: string;
  primary: string | number;
  caption?: string;
  tone?: Tone;
  pulse?: boolean;
  hidden?: boolean;
}

const toneRing: Record<Tone, string> = {
  primary: 'ring-primary/20 hover:ring-primary/40',
  success: 'ring-success/20 hover:ring-success/40',
  warning: 'ring-warning/30 hover:ring-warning/50',
  destructive: 'ring-destructive/30 hover:ring-destructive/50',
  accent: 'ring-accent/30 hover:ring-accent/50',
  muted: 'ring-border hover:ring-border',
};

const toneIcon: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary ring-primary/20',
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/15 text-warning ring-warning/25',
  destructive: 'bg-destructive/10 text-destructive ring-destructive/25',
  accent: 'bg-accent/15 text-accent-foreground ring-accent/25',
  muted: 'bg-muted text-muted-foreground ring-border',
};

function LiveTile({ to, icon: Icon, label, primary, caption, tone = 'primary', pulse, hidden }: LiveTileProps) {
  if (hidden) return null;
  return (
    <Link
      to={to}
      className={`group relative rounded-xl bg-card ring-1 ${toneRing[tone]} px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-sm`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`relative h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ring-1 ${toneIcon[tone]}`}>
          <Icon className="h-4 w-4" />
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card animate-pulse" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
            {label}
          </p>
          <p className="font-heading font-black text-base tabular-nums leading-tight truncate">
            {primary}
          </p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
      </div>
      {caption && (
        <p className="mt-1.5 text-[10px] text-muted-foreground truncate pl-[42px]">{caption}</p>
      )}
    </Link>
  );
}

export default function LiveOpsGrid() {
  const ops = useLiveOps();
  const plan = usePlanFeatures();

  return (
    <div className="card-elevated p-3.5">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" aria-hidden />
          <h3 className="font-heading font-black text-xs tracking-wider uppercase text-muted-foreground">
            Operação ao vivo
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">Atualiza a cada 30s</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <LiveTile
          to="/restaurant/tables"
          icon={UtensilsCrossed}
          label="Mesas"
          primary={ops.tablesTotal > 0 ? `${ops.tablesBusy}/${ops.tablesTotal}` : '—'}
          caption={ops.tablesBusy > 0 ? `${ops.tablesBusy} ocupada${ops.tablesBusy > 1 ? 's' : ''}` : 'Todas livres'}
          tone={ops.tablesBusy > 0 ? 'primary' : 'muted'}
          pulse={ops.openCalls > 0}
        />
        <LiveTile
          to="/restaurant/kitchen"
          icon={ChefHat}
          label="Cozinha"
          primary={ops.kitchenInPrep + ops.kitchenReady}
          caption={`${ops.kitchenInPrep} preparo · ${ops.kitchenReady} pronto`}
          tone={ops.kitchenReady > 0 ? 'success' : ops.kitchenInPrep > 5 ? 'warning' : 'primary'}
          hidden={!plan.loading && !plan.hasKds}
        />
        <LiveTile
          to="/restaurant/dj"
          icon={Music}
          label="DJ"
          primary={ops.djQueued + ops.djPlaying}
          caption={ops.djPlaying > 0 ? `🎵 Tocando agora` : `${ops.djQueued} na fila`}
          tone={ops.djPlaying > 0 ? 'accent' : ops.djQueued > 0 ? 'primary' : 'muted'}
        />
        <LiveTile
          to="/restaurant/inventory"
          icon={Package}
          label="Estoque"
          primary={ops.lowStock > 0 ? ops.lowStock : '✓'}
          caption={ops.lowStock > 0 ? `${ops.lowStock} item${ops.lowStock > 1 ? 's' : ''} crítico${ops.lowStock > 1 ? 's' : ''}` : 'Tudo ok'}
          tone={ops.lowStock > 0 ? 'destructive' : 'success'}
          hidden={!plan.loading && !plan.hasInventory}
          pulse={ops.lowStock > 0}
        />
        <LiveTile
          to="/restaurant/deliveries"
          icon={Truck}
          label="Entregadores"
          primary={ops.driversOnline + ops.driversBusy}
          caption={`${ops.driversOnline} livre · ${ops.driversBusy} em rota`}
          tone={ops.driversOnline === 0 && ops.driversBusy === 0 ? 'muted' : ops.driversOnline === 0 ? 'warning' : 'success'}
        />
        <LiveTile
          to="/restaurant/waiter-calls"
          icon={Bell}
          label="Chamadas"
          primary={ops.openCalls}
          caption={ops.openCalls > 0 ? 'Aguardando atendimento' : 'Sem pendências'}
          tone={ops.openCalls > 0 ? 'destructive' : 'muted'}
          pulse={ops.openCalls > 0}
        />
      </div>
    </div>
  );
}
