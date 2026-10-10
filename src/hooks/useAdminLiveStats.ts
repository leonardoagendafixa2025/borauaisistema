import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Live counters for the admin status bar:
 * - openOrders: orders not completed/cancelled
 * - busyTables: distinct tables with open dine-in orders
 * - djQueue: queued music requests waiting to play
 */
export function useAdminLiveStats() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ['admin-live-stats', restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!restaurantId) return { openOrders: 0, busyTables: 0, djQueue: 0 };

      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      const [orders, tables, dj] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .not('status', 'in', '("completed","cancelled")')
          .gte('created_at', since),
        supabase
          .from('orders')
          .select('table_id')
          .eq('restaurant_id', restaurantId)
          .eq('type', 'dine_in')
          .not('status', 'in', '("completed","cancelled")')
          .not('table_id', 'is', null)
          .gte('created_at', since),
        supabase
          .from('music_requests' as any)
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('status', 'queued'),
      ]);

      const busy = new Set((tables.data || []).map((r: any) => r.table_id)).size;

      return {
        openOrders: orders.count ?? 0,
        busyTables: busy,
        djQueue: (dj as any).count ?? 0,
      };
    },
  });

  // Invalidate on realtime mutations
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`admin-live-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['admin-live-stats', restaurantId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_requests', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['admin-live-stats', restaurantId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc]);

  return stats.data ?? { openOrders: 0, busyTables: 0, djQueue: 0 };
}
