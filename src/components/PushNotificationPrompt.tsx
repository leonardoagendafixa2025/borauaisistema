import { useState, useEffect } from 'react';
import { Bell, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebPush } from '@/hooks/useWebPush';
import { toast } from 'sonner';

export default function PushNotificationPrompt() {
  const { status, subscribe, busy } = useWebPush();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Se o aparelho já está inscrito ou não suporta, não exibe
    if (status !== 'unsubscribed') {
      setDismissed(true);
      return;
    }

    const wasDismissed = sessionStorage.getItem('borauai_push_prompt_dismissed');
    if (!wasDismissed) {
      // Exibe após 3 segundos navegando
      const timer = setTimeout(() => setDismissed(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (dismissed || status !== 'unsubscribed') return null;

  const handleSubscribe = async () => {
    try {
      await subscribe();
      toast.success('🎉 Notificações ativadas com sucesso neste aparelho!');
      setDismissed(true);
    } catch (e: any) {
      toast.error(e?.message || 'Permissão não concedida.');
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('borauai_push_prompt_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-reveal-up">
      <div className="rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl p-4 flex items-start gap-3.5">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
          <Bell className="h-5 w-5 animate-bounce" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
            <span>Ativar Notificações</span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Receba novidades, pedidos em rota e promoções mesmo com o aplicativo fechado!
          </p>

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleSubscribe}
              disabled={busy}
              className="h-8 text-xs font-bold gap-1.5 shadow-sm"
            >
              <Bell className="h-3.5 w-3.5" />
              {busy ? 'Ativando…' : 'Ativar Agora'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Agora não
            </Button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
