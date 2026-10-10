import { WifiOff, CloudUpload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DashboardAction } from '@/lib/offlineDb';

interface Props {
  online: boolean;
  pendingActions: DashboardAction[];
}

export default function OfflineQueueBanner({ online, pendingActions }: Props) {
  const count = pendingActions.length;
  if (online && count === 0) return null;

  // Online with pending → syncing state
  if (online && count > 0) {
    const failed = pendingActions.filter(a => a.status === 'failed').length;
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-warning/10 ring-1 ring-warning/30 px-4 py-2.5 text-xs">
        <CloudUpload className="h-4 w-4 text-warning shrink-0 animate-pulse" />
        <span className="font-bold text-warning">
          Sincronizando {count} {count === 1 ? 'ação' : 'ações'}…
        </span>
        {failed > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-destructive font-bold">
            <AlertTriangle className="h-3 w-3" /> {failed} com erro
          </span>
        )}
      </div>
    );
  }

  // Offline
  return (
    <div className="rounded-2xl bg-destructive/10 ring-1 ring-destructive/30 px-4 py-3 text-xs">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-destructive shrink-0" />
        <span className="font-black text-destructive uppercase tracking-wider">Modo offline</span>
        {count > 0 && (
          <span className="ml-auto rounded-full bg-destructive text-destructive-foreground px-2 py-0.5 font-black tabular-nums">
            {count} na fila
          </span>
        )}
      </div>
      <p className="mt-1.5 text-muted-foreground leading-snug">
        Suas ações continuam sendo registradas e serão enviadas automaticamente quando a internet voltar.
        Os dados exibidos são o último snapshot salvo.
      </p>
      {count > 0 && (
        <ul className="mt-2 space-y-1 max-h-24 overflow-y-auto pr-1">
          {pendingActions.slice(0, 6).map(a => (
            <li key={a.localId} className="flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="h-3 w-3 text-warning shrink-0" />
              <span className="font-bold truncate">{a.label || `${a.table} #${a.rowId.slice(0, 6)}`}</span>
            </li>
          ))}
          {count > 6 && <li className="text-[10px] text-muted-foreground">+{count - 6} outras…</li>}
        </ul>
      )}
    </div>
  );
}
