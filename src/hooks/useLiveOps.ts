import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Live operations widget data — pulled in parallel for the dashboard's
 * "Live Operations" grid. Used by the dense home overview.
 *
 * Returns:
 * - tablesBusy / tablesTotal: occupancy
 * - kitchenInPrep: orders currently being prepared
 * - kitchenReady: orders ready to deliver/pickup
 * - djQueued / djPlaying: music request queue
 * - lowStock: inventory items at or below min_stock
 * - driversOnline / driversBusy: delivery driver status
 * - openCallsCount: pending waiter calls
 */
export function useLiveOps() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['live-ops', restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      if (!restaurantId) return null;
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      const [tables, prepOrders, readyOrders, dj, inv, drivers, calls] = await Promise.all([
        supabase
          .from('restaurant_tables' as any)
          .select('id,status')
          .eq('restaurant_id', restaurantId),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .in('status', ['accepted', 'preparing'])
          .gte('created_at', since),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .in('status', ['ready', 'waiting_pickup'])
          .gte('created_at', since),
        supabase
          .from('music_requests' as any)
          .select('id,status')
          .eq('restaurant_id', restaurantId)
          .in('status', ['queued', 'playing']),
        supabase
          .from('inventory_items' as any)
          .select('id,current_stock,min_stock')
          .eq('restaurant_id', restaurantId),
        supabase
          .from('delivery_drivers' as any)
          .select('id,status')
          .eq('restaurant_id', restaurantId),
        supabase
          .from('waiter_calls')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('status', 'pending'),
      ]);

      const t = (tables.data || []) as any[];
      const tablesBusy = t.filter(x => x.status === 'occupied').length;
      const tablesTotal = t.length;

      const djRows = (dj.data || []) as any[];
      const djQueued = djRows.filter(r => r.status === 'queued').length;
      const djPlaying = djRows.filter(r => r.status === 'playing').length;

      const invRows = (inv.data || []) as any[];
      const lowStock = invRows.filter(r =>
        r.min_stock != null && Number(r.current_stock) <= Number(r.min_stock),
      ).length;

      const drvRows = (drivers.data || []) as any[];
      const driversOnline = drvRows.filter(r => r.status === 'available').length;
      const driversBusy = drvRows.filter(r => r.status === 'busy' || r.status === 'delivering').length;

      return {
        tablesBusy,
        tablesTotal,
        kitchenInPrep: (prepOrders as any).count ?? 0,
        kitchenReady: (readyOrders as any).count ?? 0,
        djQueued,
        djPlaying,
        lowStock,
        driversOnline,
        driversBusy,
        openCalls: (calls as any).count ?? 0,
      };
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`live-ops-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['live-ops', restaurantId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['live-ops', restaurantId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_requests', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['live-ops', restaurantId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['live-ops', restaurantId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc]);

  return query.data ?? {
    tablesBusy: 0, tablesTotal: 0,
    kitchenInPrep: 0, kitchenReady: 0,
    djQueued: 0, djPlaying: 0,
    lowStock: 0,
    driversOnline: 0, driversBusy: 0,
    openCalls: 0,
  };
}
