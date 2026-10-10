import { useEffect, useState } from 'react';
import { Sun, Moon, Sunrise, Sunset, Activity, Focus, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { LiveStatus } from '@/hooks/useRealtimeDashboard';

interface Props {
  restaurantName?: string;
  isOpen: boolean;
  activeOrdersCount: number;
  pendingCallsCount: number;
  focusMode: boolean;
  onToggleFocus: () => void;
  liveStatus?: LiveStatus;
  lastEventAt?: Date;
  onRefresh?: () => void;
}

function liveLabel(s: LiveStatus) {
  switch (s) {
    case 'live': return { text: 'AO VIVO', cls: 'bg-success/15 text-success ring-success/30', dot: 'bg-success animate-pulse', Icon: Wifi };
    case 'connecting': return { text: 'Conectando…', cls: 'bg-muted text-muted-foreground ring-border', dot: 'bg-muted-foreground animate-pulse', Icon: Wifi };
    case 'reconnecting': return { text: 'Reconectando…', cls: 'bg-warning/15 text-warning ring-warning/30', dot: 'bg-warning animate-pulse', Icon: RefreshCw };
    case 'offline': return { text: 'Offline', cls: 'bg-destructive/15 text-destructive ring-destructive/30', dot: 'bg-destructive', Icon: WifiOff };
  }
}

function shortAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return 'agora';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

function getGreeting(h: number) {
  if (h < 5) return { text: 'Boa madrugada', Icon: Moon };
  if (h < 12) return { text: 'Bom dia', Icon: Sunrise };
  if (h < 18) return { text: 'Boa tarde', Icon: Sun };
  if (h < 22) return { text: 'Boa noite', Icon: Sunset };
  return { text: 'Boa madrugada', Icon: Moon };
}

export default function DashboardHero({
  restaurantName,
  isOpen,
  activeOrdersCount,
  pendingCallsCount,
  focusMode,
  onToggleFocus,
  liveStatus = 'connecting',
  lastEventAt,
  onRefresh,
}: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const live = liveLabel(liveStatus);

  const g = getGreeting(now.getHours());
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative overflow-hidden rounded-3xl ring-1 ring-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-6">
      {/* Decorative blobs */}
      <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex-wrap">
            <g.Icon className="h-3.5 w-3.5 text-primary" />
            <span>{g.text}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline capitalize">{dateStr}</span>
            <button
              type="button"
              onClick={onRefresh}
              title={lastEventAt ? `Última atualização: ${shortAgo(lastEventAt)} atrás · clique para forçar refresh` : 'Atualizar'}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${live.cls} hover:opacity-80 transition`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live.dot}`} />
              <live.Icon className="h-2.5 w-2.5" />
              {live.text}
              {lastEventAt && liveStatus === 'live' && (
                <span className="text-[9px] opacity-70 normal-case font-bold">· {shortAgo(lastEventAt)}</span>
              )}
            </button>
          </div>
          <h1 className="font-heading text-2xl sm:text-4xl font-black tracking-tight mt-1.5 truncate">
            Central de Operações
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {restaurantName ? <>Você está no comando de <span className="font-bold text-foreground">{restaurantName}</span></> : 'Tudo o que está acontecendo agora.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live clock */}
          <div className="flex flex-col items-end">
            <div className="font-heading text-2xl sm:text-3xl font-black tabular-nums tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-primary to-primary-glow">
              {timeStr}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
              {isOpen ? 'OPERANDO' : 'FECHADO'}
              {activeOrdersCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-primary">{activeOrdersCount} ativos</span>
                </>
              )}
              {pendingCallsCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-warning">{pendingCallsCount} chamadas</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onToggleFocus}
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition-all hover:-translate-y-0.5 ${
              focusMode
                ? 'bg-primary text-primary-foreground ring-primary shadow-lg shadow-primary/30'
                : 'ring-border bg-background hover:ring-primary/30'
            }`}
            title="Modo Foco — esconde tudo exceto pedidos ativos"
          >
            {focusMode ? <Activity className="h-3.5 w-3.5" /> : <Focus className="h-3.5 w-3.5" />}
            {focusMode ? 'Foco ativo' : 'Modo Foco'}
          </button>
        </div>
      </div>
    </div>
  );
}
