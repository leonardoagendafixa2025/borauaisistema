import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Notification {
  id: string;
  user_id: string;
  restaurant_id: string | null;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Notification[];
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  };

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}

// Helper to create a notification (call from anywhere)
export async function createNotification(params: {
  user_id: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  restaurant_id?: string;
}) {
  return supabase.from('notifications').insert({
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    message: params.message || null,
    link: params.link || null,
    restaurant_id: params.restaurant_id || null,
  });
}
