import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { useAuth } from './useAuth';

export type MusicRequest = {
  id: string;
  restaurant_id: string;
  song_text: string;
  dedication: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  table_label: string | null;
  price: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  status: 'pending_approval' | 'queued' | 'playing' | 'played' | 'rejected';
  played_at: string | null;
  rejected_reason: string | null;
  order_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApproveResult = {
  request_id: string;
  order_id: string | null;
  order_item_id: string | null;
  linked_to_tab: boolean;
};

export type RejectResult = {
  request_id: string;
  refunded_from_tab: boolean;
  order_id: string | null;
};

// ============ ADMIN (DJ) HOOKS ============
export function useMusicRequestsList() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['music-requests', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('music_requests' as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MusicRequest[];
    },
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`music-requests-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'music_requests', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['music-requests', restaurantId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  return query;
}

export function useUpdateMusicRequest() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<MusicRequest> & { id: string }) => {
      const payload: any = { ...patch };
      if (patch.status === 'playing' && !patch.played_at) {
        // marca início — opcional
      }
      if (patch.status === 'played' && !patch.played_at) {
        payload.played_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('music_requests' as any)
        .update(payload as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music-requests', restaurantId] }),
  });
}

export function useDeleteMusicRequest() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('music_requests' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music-requests', restaurantId] }),
  });
}

export function useApproveMusicRequest() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc('approve_music_request', { _request_id: id });
      if (error) throw error;
      return data as ApproveResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['music-requests', restaurantId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRejectMusicRequest() {
  const qc = useQueryClient();
  const { restaurantId } = useAuth();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await (supabase as any).rpc('reject_music_request', {
        _request_id: id,
        _reason: reason,
      });
      if (error) throw error;
      return data as RejectResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['music-requests', restaurantId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ============ PUBLIC HOOKS ============
export function usePublicMusicQueue(restaurantId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['public-music-queue', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as MusicRequest[];
      const { data, error } = await publicSupabase
        .from('music_requests' as any)
        .select('id,song_text,status,created_at,played_at,table_label')
        .eq('restaurant_id', restaurantId)
        .in('status', ['queued', 'playing'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as MusicRequest[];
    },
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (!restaurantId) return;
    const ch = publicSupabase
      .channel(`public-music-queue-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'music_requests', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['public-music-queue', restaurantId] }),
      )
      .subscribe();
    return () => {
      publicSupabase.removeChannel(ch);
    };
  }, [restaurantId, qc]);

  return query;
}

export type OpenCommand = {
  id: string;
  customer_name: string;
  opened_at: string;
  open_total: number;
};

/** Lists open commands of a table — used in the "cobrar de quem?" chooser. */
export function useOpenCommandsForTable(restaurantId: string | null, tableLabel: string | null) {
  return useQuery({
    queryKey: ['open-commands', restaurantId, tableLabel],
    queryFn: async (): Promise<OpenCommand[]> => {
      if (!restaurantId || !tableLabel) return [];
      const { data, error } = await (publicSupabase as any).rpc('list_open_commands_for_table', {
        _restaurant_id: restaurantId,
        _table_label: tableLabel,
      });
      if (error) throw error;
      return (data || []) as OpenCommand[];
    },
    enabled: !!restaurantId && !!tableLabel,
    staleTime: 15_000,
  });
}

export function useSubmitMusicRequest() {
  return useMutation({
    mutationFn: async (input: {
      restaurant_id: string;
      song_text: string;
      dedication?: string;
      customer_name?: string;
      customer_phone?: string;
      table_label?: string;
      price: number;
      billing_mode?: 'table' | 'command';
      command_id?: string | null;
    }) => {
      // Rate-limit client (sessionStorage) — máx 3 pedidos por 30min
      const KEY = `music-req-${input.restaurant_id}`;
      const now = Date.now();
      const raw = sessionStorage.getItem(KEY);
      const past: number[] = raw ? JSON.parse(raw) : [];
      const recent = past.filter((t) => now - t < 30 * 60 * 1000);
      if (recent.length >= 3) {
        throw new Error('Você atingiu o limite de pedidos por sessão. Tente novamente em alguns minutos.');
      }

      const { data, error } = await publicSupabase
        .from('music_requests' as any)
        .insert({
          restaurant_id: input.restaurant_id,
          song_text: input.song_text.trim(),
          dedication: input.dedication?.trim() || null,
          customer_name: input.customer_name?.trim() || null,
          customer_phone: input.customer_phone?.trim() || null,
          table_label: input.table_label?.trim() || null,
          price: input.price,
          billing_mode: input.billing_mode || 'table',
          command_id: input.command_id || null,
          payment_status: input.price > 0 ? 'pending' : 'paid',
          status: 'queued',
        } as any)
        .select()
        .single();
      if (error) throw error;

      sessionStorage.setItem(KEY, JSON.stringify([...recent, now]));
      return data as unknown as MusicRequest;
    },
  });
}
