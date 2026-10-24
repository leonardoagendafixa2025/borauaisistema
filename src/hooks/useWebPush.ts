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
import { getApiUrl } from '@/lib/api';

export type PushStatus = 'unsupported' | 'needs-pwa' | 'denied' | 'unsubscribed' | 'subscribed';

export function useWebPush(restaurantIdOverride?: string | null) {
  let user: any = null;
  let authRestaurantId: string | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    user = auth?.user ?? null;
    authRestaurantId = auth?.restaurantId ?? null;
  } catch {
    // Graceful fallback if called outside AuthProvider
  }

  const effectiveRestaurantId = restaurantIdOverride !== undefined ? restaurantIdOverride : authRestaurantId;

  const [status, setStatus] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      if (!isPushSupported() || typeof Notification === 'undefined') {
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
      if (!reg) {
        setStatus('unsubscribed');
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'subscribed' : 'unsubscribed');
    } catch {
      setStatus('unsupported');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    try {
      if (!isPushSupported() || typeof Notification === 'undefined') {
        if (isIOS() && !isStandalonePWA()) {
          throw new Error('No iPhone, toque em Compartilhar e "Adicionar à Tela de Início" para ativar notificações.');
        }
        throw new Error('Seu navegador não suporta notificações Push.');
      }

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

      // Pede permissão nativa do navegador
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'unsubscribed');
        throw new Error(perm === 'denied' ? 'Permissão de notificação negada no navegador.' : 'Permissão não concedida.');
      }

      // Limpa subscription antiga órfã se houver
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {}
      }

      // Cria nova subscription com a chave pública VAPID
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
              ? 'O Xiaomi/MIUI está bloqueando o serviço de push do Google. Vá em Ajustes → Apps → Chrome → Notificações: ative tudo e desative economia de bateria.'
              : 'O Google bloqueou o registro de push. Verifique se o Google Play Services está ativo e tente novamente em instantes.';
          } else if (err2?.name === 'NotAllowedError') {
            msg = 'Permissão de notificações bloqueada. Toque no cadeado ao lado da URL → Notificações → Permitir.';
          } else if (err2?.name === 'NotSupportedError') {
            msg = 'Este navegador não suporta push. Use Chrome ou Edge atualizado.';
          } else {
            msg = `Erro ao registrar push: ${err2?.message || err2?.name || 'desconhecido'}`;
          }
          throw new Error(msg);
        }
      }

      const json = sub.toJSON() as any;
      const endpoint = sub.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        throw new Error('Subscription de push inválida.');
      }

      // Salva no backend através da API /api/send-push (suporta visitantes e usuários logados)
      const resp = await fetch(getApiUrl('/api/send-push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          endpoint,
          p256dh,
          auth,
          user_id: user?.id || null,
          restaurant_id: effectiveRestaurantId || null,
          user_agent: navigator.userAgent.slice(0, 200),
          device_label: isStandalonePWA() ? 'PWA' : 'Browser',
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao salvar inscrição no servidor.');
      }

      setStatus('subscribed');
    } finally {
      setBusy(false);
    }
  }, [user, effectiveRestaurantId]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Remove do servidor
        await fetch(getApiUrl('/api/send-push'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unsubscribe',
            endpoint: sub.endpoint,
          }),
        }).catch(() => {});

        // Remove do banco Supabase diretamente se autenticado
        try {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } catch {}

        await sub.unsubscribe();
      }
      setStatus('unsubscribed');
    } finally {
      setBusy(false);
    }
  }, []);

  // Se o usuário logou posteriormente e o aparelho já possui inscrição, atualiza no banco
  useEffect(() => {
    if (!user?.id || status !== 'subscribed') return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          const json = sub.toJSON() as any;
          await fetch(getApiUrl('/api/send-push'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'subscribe',
              endpoint: sub.endpoint,
              p256dh: json.keys?.p256dh,
              auth: json.keys?.auth,
              user_id: user.id,
              restaurant_id: effectiveRestaurantId || null,
              user_agent: navigator.userAgent.slice(0, 200),
              device_label: isStandalonePWA() ? 'PWA' : 'Browser',
            }),
          }).catch(() => {});
        }
      } catch {}
    })();
  }, [user?.id, status, effectiveRestaurantId]);

  return { status, busy, subscribe, unsubscribe, refresh, isIOS: isIOS() };
}
