import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

/**
 * Realtime feed for the Operations Center dashboard.
 *
 * - Subscribes to orders, waiter_calls, restaurant_settings, restaurants and
 *   financial_transactions for the current tenant via Supabase Realtime.
 * - Invalidates the relevant React Query caches so every widget refreshes
 *   without a page reload.
 * - Adds a visibility/online fallback that refetches and reconnects when the
 *   tab returns to focus or the network comes back, and a low-frequency
 *   safety polling (60s) in case WebSocket frames are silently dropped.
 * - Exposes connection status + last-update timestamp for the "AO VIVO" pill.
 */
export function useRealtimeDashboard() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<Date>(new Date());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshAll = useCallback(() => {
    if (!restaurantId) return;
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['waiter_calls', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['restaurant_settings', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['yesterday_orders', restaurantId] });
    setLastEventAt(new Date());
  }, [restaurantId, queryClient]);

  useEffect(() => {
    if (!restaurantId) return;

    setStatus('connecting');

    const channel = supabase
      .channel(`dashboard-live-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
        setLastEventAt(new Date());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['waiter_calls', restaurantId] });
        setLastEventAt(new Date());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_settings', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['restaurant_settings', restaurantId] });
        setLastEventAt(new Date());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
        setLastEventAt(new Date());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['financial_transactions', restaurantId] });
        setLastEventAt(new Date());
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setStatus('live');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('reconnecting');
        else if (s === 'CLOSED') setStatus('offline');
      });

    channelRef.current = channel;

    // Safety polling fallback (every 60s) — picks up anything realtime missed.
    const pollId = setInterval(refreshAll, 60_000);

    // Refetch on tab focus / network reconnection.
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAll(); };
    const onOnline = () => { setStatus('reconnecting'); refreshAll(); };
    const onOffline = () => setStatus('offline');

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [restaurantId, queryClient, refreshAll]);

  return { status, lastEventAt, refresh: refreshAll };
}
