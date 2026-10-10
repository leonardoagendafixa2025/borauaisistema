import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface UsePWAInstall {
  /** Pode disparar o prompt nativo de instalação (Android/Chrome/Edge) */
  canInstall: boolean;
  /** Já está instalado/standalone */
  isStandalone: boolean;
  /** É iOS/iPadOS (precisa de instrução manual: Compartilhar → Adicionar à Tela) */
  isIOS: boolean;
  /** É Safari no iOS — único browser do iOS que instala PWA */
  isIOSSafari: boolean;
  /** Dispara o prompt nativo. Resolve com true se aceito */
  promptInstall: () => Promise<boolean>;
}

/**
 * Detecta iOS incluindo iPadOS 13+ que se identifica como Mac com touch.
 */
function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const platform = (window.navigator as any).platform || '';
  const iOSClassic = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
  // iPadOS 13+: reporta como Mac mas tem touch
  const iPadOS13Up =
    platform === 'MacIntel' && (window.navigator.maxTouchPoints || 0) > 1;
  return iOSClassic || iPadOS13Up;
}

/**
 * Detecta Safari no iOS — exclui Chrome (CriOS), Firefox (FxiOS),
 * Edge (EdgiOS), Opera (OPiOS) e WebViews embutidas.
 */
function detectIOSSafari(): boolean {
  if (!detectIOS()) return false;
  const ua = window.navigator.userAgent;
  // Outros browsers no iOS usam o WebKit do sistema mas têm marca própria
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|UCBrowser/.test(ua);
  if (isOtherBrowser) return false;
  // WebView (apps embutidos): Safari tem "Safari/" no UA, WebView não
  const hasSafariMarker = /Safari\//.test(ua);
  return hasSafariMarker;
}

export function usePWAInstall(manifestHref?: string): UsePWAInstall {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);

  // Troca o manifest dinamicamente enquanto montado
  useEffect(() => {
    if (!manifestHref) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const previous = link.getAttribute('href');
    link.setAttribute('href', manifestHref);
    return () => {
      if (previous) link.setAttribute('href', previous);
    };
  }, [manifestHref]);

  useEffect(() => {
    setIsIOS(detectIOS());
    setIsIOSSafari(detectIOSSafari());

    const standaloneMql = window.matchMedia('(display-mode: standalone)');
    const updateStandalone = () => {
      setIsStandalone(
        standaloneMql.matches || (window.navigator as any).standalone === true,
      );
    };
    updateStandalone();
    standaloneMql.addEventListener?.('change', updateStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      standaloneMql.removeEventListener?.('change', updateStandalone);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt,
    isStandalone,
    isIOS,
    isIOSSafari,
    promptInstall,
  };
}
