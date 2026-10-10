import { useEffect, useState } from 'react';
import { publicSupabase } from '@/integrations/supabase/public-client';

/**
 * Returns true when the restaurant's current subscription plan (Professional/Premium)
 * includes the "Reservar Mesa" feature. Reads via a SECURITY DEFINER RPC so anon can query.
 */
export function useRestaurantReservationsEnabled(restaurantId: string | null | undefined) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!restaurantId) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    (publicSupabase.rpc as any)('restaurant_has_reservations', { _restaurant_id: restaurantId })
      .then(({ data }: { data: boolean | null }) => {
        if (!cancelled) {
          setEnabled(!!data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnabled(false);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [restaurantId]);

  return { enabled, loading };
}
