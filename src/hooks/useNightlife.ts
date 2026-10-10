import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { useAuth } from './useAuth';

export type NightlifeAct = {
  id: string;
  restaurant_id: string;
  artist_name: string;
  genre: string | null;
  description: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type NightlifeHourDrink = {
  id: string;
  restaurant_id: string;
  product_id: string | null;
  custom_name: string | null;
  custom_image_url: string | null;
  promo_price: number;
  starts_at: string;
  ends_at: string;
  highlight_text: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// ============ ADMIN HOOKS ============
export function useNightlifeActs() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['nightlife-acts', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('nightlife_acts' as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as NightlifeAct[];
    },
    enabled: !!restaurantId,
  });
}

export function useNightlifeDrinks() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['nightlife-drinks', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('nightlife_hour_drinks' as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as NightlifeHourDrink[];
    },
    enabled: !!restaurantId,
  });
}

export function useSaveAct() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async (act: Partial<NightlifeAct> & { id?: string }) => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const payload = { ...act, restaurant_id: restaurantId } as any;
      if (act.id) {
        const { error } = await supabase.from('nightlife_acts' as any).update(payload as any).eq('id', act.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('nightlife_acts' as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nightlife-acts', restaurantId] }),
  });
}

export function useDeleteAct() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nightlife_acts' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nightlife-acts', restaurantId] }),
  });
}

export function useSaveDrink() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async (drink: Partial<NightlifeHourDrink> & { id?: string }) => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const payload = { ...drink, restaurant_id: restaurantId } as any;
      if (drink.id) {
        const { error } = await supabase.from('nightlife_hour_drinks' as any).update(payload as any).eq('id', drink.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('nightlife_hour_drinks' as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nightlife-drinks', restaurantId] }),
  });
}

export function useDeleteDrink() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nightlife_hour_drinks' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nightlife-drinks', restaurantId] }),
  });
}

// ============ PUBLIC HOOKS (no auth) ============
export function usePublicNightlife(restaurantId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['public-nightlife', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { acts: [] as NightlifeAct[], drinks: [] as NightlifeHourDrink[] };
      const [actsRes, drinksRes] = await Promise.all([
        publicSupabase
          .from('nightlife_acts' as any)
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('active', true)
          .order('starts_at', { ascending: true }),
        publicSupabase
          .from('nightlife_hour_drinks' as any)
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('active', true)
          .order('starts_at', { ascending: true }),
      ]);
      return {
        acts: ((actsRes.data || []) as unknown as NightlifeAct[]),
        drinks: ((drinksRes.data || []) as unknown as NightlifeHourDrink[]),
      };
    },
    enabled: !!restaurantId,
    refetchOnWindowFocus: true,
  });

  // Realtime: invalidar quando algo mudar
  useEffect(() => {
    if (!restaurantId) return;
    const ch = publicSupabase
      .channel(`public-nightlife-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nightlife_acts', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        qc.invalidateQueries({ queryKey: ['public-nightlife', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nightlife_hour_drinks', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        qc.invalidateQueries({ queryKey: ['public-nightlife', restaurantId] });
      })
      .subscribe();
    return () => {
      publicSupabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  return query;
}
