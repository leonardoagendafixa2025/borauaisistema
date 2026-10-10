// Configuração pública do Web Push.
// A chave VAPID pública é desenhada para ficar no frontend — só identifica o servidor.
export const VAPID_PUBLIC_KEY =
  'BMkpzoytZiuqXwE5Jo2ltua-FDxnx5gVc95jsNcXLbKNgeQUIG877urEy6B84aG8OiwXGnKd702nEunMSozAQqU';

export const SW_PATH = '/sw-garcom.js';

/** Converte a chave VAPID base64url em Uint8Array para a Push API. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iOS exige que o site esteja instalado como PWA pra aceitar push. */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}
