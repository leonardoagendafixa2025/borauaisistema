import { Volume2, VolumeX, Vibrate, Smartphone } from 'lucide-react';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Props {
  /** 'compact' = só dois ícones-botão (header). 'full' = card com labels (settings). */
  variant?: 'compact' | 'full';
}

export default function NotificationPrefsToggle({ variant = 'full' }: Props) {
  const { prefs, setSound, setVibration } = useNotificationPrefs();

  const test = () => {
    try {
      if (prefs.sound) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(900, ctx.currentTime);
        g.gain.setValueAtTime(0.25, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        o.start(); o.stop(ctx.currentTime + 0.3);
      }
      if (prefs.vibration && 'vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      toast.success('Teste enviado');
    } catch { toast.error('Falha ao testar'); }
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => setSound(!prefs.sound)}
          aria-label={prefs.sound ? 'Desativar som' : 'Ativar som'}
          className={`h-9 w-9 rounded-lg flex items-center justify-center border transition-colors ${
            prefs.sound ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'
          }`}
        >
          {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setVibration(!prefs.vibration)}
          aria-label={prefs.vibration ? 'Desativar vibração' : 'Ativar vibração'}
          className={`h-9 w-9 rounded-lg flex items-center justify-center border transition-colors ${
            prefs.vibration ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'
          }`}
        >
          <Vibrate className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" /> Notificações em tempo real
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configurações por dispositivo (salvas neste navegador). Vibração depende do suporte do aparelho — iPhone/Safari não suporta.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          <div>
            <div className="text-sm font-medium">Som</div>
            <div className="text-xs text-muted-foreground">Bipe ao receber pedido ou chamada</div>
          </div>
        </div>
        <Switch checked={prefs.sound} onCheckedChange={setSound} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Vibrate className={`h-4 w-4 ${prefs.vibration ? '' : 'text-muted-foreground'}`} />
          <div>
            <div className="text-sm font-medium">Vibração</div>
            <div className="text-xs text-muted-foreground">Vibrar o celular (chamadas vibram mais forte)</div>
          </div>
        </div>
        <Switch checked={prefs.vibration} onCheckedChange={setVibration} />
      </div>

      <button
        onClick={test}
        className="w-full rounded-lg border border-border bg-muted/40 hover:bg-muted py-2 text-sm font-medium"
      >
        Testar agora
      </button>
    </div>
  );
}
