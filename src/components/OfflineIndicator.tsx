import { Wifi, WifiOff, CloudUpload } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineIndicator() {
  const { online, pendingCount } = useOfflineSync();

  if (online && pendingCount === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success px-2.5 py-1 text-xs font-medium">
        <Wifi className="h-3 w-3" />
        Online
      </div>
    );
  }

  if (!online) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 text-xs font-medium">
        <WifiOff className="h-3 w-3" />
        Offline {pendingCount > 0 && `• ${pendingCount} na fila`}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning px-2.5 py-1 text-xs font-medium animate-pulse">
      <CloudUpload className="h-3 w-3" />
      Sincronizando {pendingCount}...
    </div>
  );
}
