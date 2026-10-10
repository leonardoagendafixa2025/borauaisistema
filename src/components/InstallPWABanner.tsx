import { forwardRef, useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';

interface InstallPWABannerProps {
  variant: 'cliente' | 'garcom';
  manifestHref?: string;
  title?: string;
  description?: string;
}

const DISMISS_KEY_PREFIX = 'borauai_pwa_dismiss_';
const DISMISS_DAYS = 7;

const InstallPWABanner = forwardRef<HTMLDivElement, InstallPWABannerProps>(function InstallPWABanner(
  { variant, manifestHref, title, description },
  forwardedRef,
) {
  const { canInstall, isStandalone, isIOS, isIOSSafari, promptInstall } =
    usePWAInstall(manifestHref);
  const [dismissed, setDismissed] = useState(true); // start hidden até checar localStorage

  useEffect(() => {
    const at = localStorage.getItem(DISMISS_KEY_PREFIX + variant);
    if (!at) {
      setDismissed(false);
      return;
    }
    const ageDays = (Date.now() - Number(at)) / (1000 * 60 * 60 * 24);
    setDismissed(ageDays < DISMISS_DAYS);
  }, [variant]);

  const handleInstall = async () => {
    const ok = await promptInstall();
    if (ok) {
      toast.success('App instalado!');
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY_PREFIX + variant, String(Date.now()));
    setDismissed(true);
  };

  if (isStandalone || dismissed) return null;
  // No iOS: apenas Safari consegue adicionar à tela inicial. No Android/Desktop: download do .apk sempre disponível.
  if (isIOS && !isIOSSafari) return null;

  const defaultTitle =
    variant === 'garcom' ? 'Baixar Bora Uai Garçom (.apk)' : 'Baixar app Bora Uai (.apk)';
  const defaultDescription =
    variant === 'garcom'
      ? 'Baixe o aplicativo Android (.apk) para agilidade no atendimento e notificações.'
      : 'Baixe o aplicativo Android (.apk) para pedir mais rápido e receber notificações.';

  return (
    <div
      ref={forwardedRef}
      className="fixed bottom-0 left-0 right-0 z-[100] p-3 sm:p-4 pointer-events-none"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-w-md pointer-events-auto rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-2xl p-4 flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden">
          <img
            src={variant === 'cliente' ? '/pwa-cliente-192.png' : '/pwa-192.png'}
            alt="Bora Uai"
            className="w-full h-full object-cover"
            width={48}
            height={48}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm text-foreground">
            {title ?? defaultTitle}
          </p>
          {isIOS ? (
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <p className="flex items-center flex-wrap gap-1">
                <span>1. Toque em</span>
                <Share className="w-3.5 h-3.5 inline-block text-primary" aria-label="Compartilhar" />
                <span className="font-medium">Compartilhar</span>
              </p>
              <p className="flex items-center flex-wrap gap-1">
                <span>2. Escolha</span>
                <Plus className="w-3.5 h-3.5 inline-block text-primary" aria-label="Adicionar" />
                <span className="font-medium">Adicionar à Tela de Início</span>
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-0.5">
                {description ?? defaultDescription}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  asChild
                  className="h-8 text-xs font-semibold"
                >
                  <a
                    href="/borauai.apk"
                    download="borauai.apk"
                    onClick={() => {
                      toast.success('Iniciando download do aplicativo Android (.apk)...');
                      setDismissed(true);
                    }}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Baixar APK (.apk)
                  </a>
                </Button>
                {canInstall && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleInstall}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Instalar PWA
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Fechar"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default InstallPWABanner;
