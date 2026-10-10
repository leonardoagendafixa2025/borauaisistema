import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Returns yesterday's orders (full day) for delta comparisons.
 * Used by the dashboard for the "vs ontem" badge on metric cards.
 */
export function useYesterdayOrders() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['orders-yesterday', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status, created_at, type')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });
}
