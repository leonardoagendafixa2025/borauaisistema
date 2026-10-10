import { Bell, BellOff, Smartphone, AlertCircle, Loader2 } from 'lucide-react';
import { useWebPush } from '@/hooks/useWebPush';
import { toast } from 'sonner';

export default function PushNotificationToggle() {
  const { status, busy, subscribe, unsubscribe, isIOS } = useWebPush();

  const handle = async () => {
    try {
      if (status === 'subscribed') {
        await unsubscribe();
        toast.success('Notificações desativadas neste aparelho');
      } else {
        await subscribe();
        toast.success('🎉 Pronto! Você vai receber alertas mesmo com a tela apagada');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao ativar notificações');
    }
  };

  if (status === 'unsupported') {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Este navegador não suporta push nativo. Use Chrome ou Safari atualizado.
      </div>
    );
  }

  if (status === 'needs-pwa') {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
        <div className="flex items-center gap-2 font-semibold text-warning">
          <Smartphone className="h-4 w-4" /> Instale o app no iPhone
        </div>
        <p className="text-muted-foreground leading-snug">
          No iOS, push só funciona com o app instalado. Toque em <strong>Compartilhar</strong> ↗ → <strong>Adicionar à Tela de Início</strong>, depois abra pelo ícone na tela inicial.
        </p>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        Permissão bloqueada. Reative nas configurações do navegador (cadeado ao lado da URL → Notificações).
      </div>
    );
  }

  const isOn = status === 'subscribed';

  return (
    <button
      onClick={handle}
      disabled={busy}
      className={`w-full rounded-lg px-3 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
        isOn
          ? 'bg-success/10 text-success border border-success/30 hover:bg-success/20'
          : 'bg-primary text-primary-foreground hover:opacity-90'
      } disabled:opacity-50`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {busy ? 'Aguarde...' : isOn ? 'Notificações ATIVAS neste aparelho' : 'Ativar notificações neste aparelho'}
    </button>
  );
}
