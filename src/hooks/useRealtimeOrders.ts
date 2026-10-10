import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { getNotificationPrefs } from './useNotificationPrefs';

const vibrate = (pattern: number | number[]) => {
  try {
    if (!getNotificationPrefs().vibration) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {}
};

const playNotificationSound = (opts?: { vibrate?: number | number[] }) => {
  const prefs = getNotificationPrefs();
  if (prefs.sound) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {}
  }
  vibrate(opts?.vibrate ?? [200, 100, 200]);
};

export function useRealtimeOrders() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const notifiedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!restaurantId) return;
    notifiedOrderIds.current.clear();

    const channel = supabase
      .channel(`orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
          const orderId = (payload.new as any)?.id;
          if (orderId && !notifiedOrderIds.current.has(orderId)) {
            notifiedOrderIds.current.add(orderId);
            playNotificationSound();
            const name = (payload.new as any)?.customer_name || 'Cliente';
            const number = (payload.new as any)?.number;
            toast.info(`🔔 Novo pedido${number ? ` #${number}` : ''} de ${name}`, { duration: 10000 });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
        }
      )
      .subscribe();

    return () => {
      notifiedOrderIds.current.clear();
      supabase.removeChannel(channel);
    };
  }, [restaurantId, queryClient]);
}

export function useRealtimeWaiterCalls() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!restaurantId) return;

    const timer = setTimeout(() => { isFirstLoad.current = false; }, 2000);

    const channel = supabase
      .channel(`waiter-calls-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['waiter_calls', restaurantId] });
          if (!isFirstLoad.current) {
            playNotificationSound({ vibrate: [400, 150, 400, 150, 400] });
            const type = (payload.new as any)?.type;
            const msg = type === 'request_bill' ? '💰 Nova solicitação de conta!' : '🔔 Chamada de garçom!';
            toast.warning(msg, { duration: 10000 });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['waiter_calls', restaurantId] });
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      isFirstLoad.current = true;
      supabase.removeChannel(channel);
    };
  }, [restaurantId, queryClient]);
}
