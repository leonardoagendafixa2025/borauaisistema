import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  VAPID_PUBLIC_KEY,
  SW_PATH,
  urlBase64ToUint8Array,
  isPushSupported,
  isStandalonePWA,
  isIOS,
} from '@/lib/pushConfig';

export type PushStatus = 'unsupported' | 'needs-pwa' | 'denied' | 'unsubscribed' | 'subscribed';

export function useWebPush() {
  let user: any = null;
  let restaurantId: string | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    user = auth?.user ?? null;
    restaurantId = auth?.restaurantId ?? null;
  } catch {
    // Graceful fallback if called outside AuthProvider
  }

  const [status, setStatus] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      if (!isPushSupported() || typeof Notification === 'undefined') {
        // iOS so aceita PWA instalado
        if (isIOS() && !isStandalonePWA()) setStatus('needs-pwa');
        else setStatus('unsupported');
        return;
      }
      if (isIOS() && !isStandalonePWA()) {
        setStatus('needs-pwa');
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      if (!reg) { setStatus('unsubscribed'); return; }
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'subscribed' : 'unsubscribed');
    } catch {
      setStatus('unsupported');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!user) throw new Error('Faça login primeiro');
    setBusy(true);
    try {
      // Registra SW e aguarda ficar ATIVO (não só ready)
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
      await navigator.serviceWorker.ready;
      // Garante que existe um SW ativo (Android às vezes fica em "installing")
      if (!reg.active) {
        await new Promise<void>((resolve) => {
          const sw = reg.installing || reg.waiting;
          if (!sw) return resolve();
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') resolve();
          });
          setTimeout(resolve, 3000);
        });
      }

      // Pede permissão
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'unsubscribed');
        throw new Error('Permissão negada');
      }

      // Limpa subscription antiga órfã (causa comum de "push service error" no Android)
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try { await existing.unsubscribe(); } catch {}
      }

      // Cria subscription
      const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyArray.buffer.slice(keyArray.byteOffset, keyArray.byteOffset + keyArray.byteLength) as ArrayBuffer,
        });
      } catch (err: any) {
        console.warn('[push] subscribe via ArrayBuffer falhou, tentando Uint8Array:', err?.name, err?.message);
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyArray as BufferSource,
          });
        } catch (err2: any) {
          console.error('[push] subscribe falhou:', err2?.name, err2?.message, err2);
          const isXiaomi = /MIUI|Xiaomi|Redmi|POCO/i.test(navigator.userAgent);
          let msg: string;
          if (err2?.name === 'AbortError') {
            msg = isXiaomi
              ? 'O Xiaomi/MIUI está bloqueando o serviço de push do Google. Vá em Ajustes → Apps → Chrome → Notificações: ative tudo. Depois desative "Economia de bateria" para o Chrome e tente novamente.'
              : 'O Google bloqueou o registro de push. Verifique: (1) conta Google ativa no aparelho, (2) Play Services atualizado, (3) economia de bateria desligada para o Chrome. Aguarde 30s e tente de novo.';
          } else if (err2?.name === 'NotAllowedError') {
            msg = 'Permissão de notificações bloqueada. Toque no cadeado ao lado da URL → Notificações → Permitir.';
          } else if (err2?.name === 'NotSupportedError') {
            msg = 'Este navegador não suporta push. Use Chrome ou Edge atualizado.';
          } else {
            msg = `Erro: ${err2?.message || err2?.name || 'desconhecido'}`;
          }
          throw new Error(msg);
        }
      }

      const json = sub.toJSON() as any;
      const endpoint = sub.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) throw new Error('Subscription inválida');

      // Salva no banco (upsert por endpoint)
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            restaurant_id: restaurantId || null,
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent.slice(0, 200),
            device_label: isStandalonePWA() ? 'PWA' : 'Browser',
            last_seen_at: new Date().toISOString(),
          } as any,
          { onConflict: 'endpoint' },
        );
      if (error) throw error;

      setStatus('subscribed');
    } finally {
      setBusy(false);
    }
  }, [user, restaurantId]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('unsubscribed');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, subscribe, unsubscribe, refresh, isIOS: isIOS() };
}
