import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

export function useRestaurant() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantOrders(statuses?: OrderStatus[], dateFilter?: 'today' | 'all') {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['orders', restaurantId, statuses, dateFilter],
    queryFn: async () => {
      if (!restaurantId) return [];
      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
      }
      if (dateFilter === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        query = query.gte('created_at', todayStart.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantCustomers() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['customers', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantCategories() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['categories', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantProducts() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['products', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('restaurant_id', restaurantId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantTables() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['tables', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantSettings() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['restaurant_settings', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantCoupons() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['coupons', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantWaiterCalls() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['waiter_calls', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('waiter_calls')
        .select('*, restaurant_tables(number, label)')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useMasterRestaurants() {
  return useQuery({
    queryKey: ['master-restaurants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*, subscriptions(*, subscription_plans(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useMasterMetrics() {
  return useQuery({
    queryKey: ['master-metrics'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [restaurants, orders, subscriptions] = await Promise.all([
        supabase.from('restaurants').select('id, status', { count: 'exact' }),
        supabase.from('orders').select('total, created_at').gte('created_at', todayStart.toISOString()),
        supabase.from('subscriptions').select('monthly_price').eq('status', 'active'),
      ]);
      
      const activeRestaurants = restaurants.data?.filter(r => ['active', 'trial'].includes(r.status)).length || 0;
      const ordersToday = orders.data?.length || 0;
      const revenueToday = orders.data?.reduce((s, o) => s + Number(o.total), 0) || 0;
      const mrr = subscriptions.data?.reduce((s, sub) => s + Number(sub.monthly_price), 0) || 0;

      return { activeRestaurants, ordersToday, revenueToday, mrr, totalRestaurants: restaurants.data?.length || 0 };
    },
  });
}

export function usePublicRestaurant(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-restaurant', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await (publicSupabase as any)
        .from('restaurants_public')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data as Database['public']['Tables']['restaurants']['Row'] | null;
    },
    enabled: !!slug,
  });
}

export function usePublicCategories(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['public-categories', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await publicSupabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function usePublicProducts(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['public-products', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await publicSupabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function usePublicSettings(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['public-settings', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      // 1. Tenta view pública com permissão irrestrita a anon
      const { data: pubData, error: pubErr } = await (publicSupabase as any)
        .from('restaurant_settings_public')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (!pubErr && pubData) return pubData;

      // 2. Fallback caso a view não esteja disponível
      const { data, error } = await publicSupabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (error) {
        console.warn('Configurações públicas não carregadas:', error.message);
        return null;
      }
      return data;
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantDeliveryZones() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['delivery_zones', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function usePublicDeliveryZones(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['public-delivery-zones', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (publicSupabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function useRestaurantCombos() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['combos', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from('product_combos')
        .select('*, product_combo_items(*, products(name, image_url, price))')
        .eq('restaurant_id', restaurantId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function usePublicCombos(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['public-combos', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (publicSupabase as any)
        .from('product_combos')
        .select('*, product_combo_items(*, products(id, name, image_url, price))')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}

export function usePublicTables(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['public-tables', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await publicSupabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });
}
