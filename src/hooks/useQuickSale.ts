import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface QuickSaleCartItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface QuickSalePayload {
  restaurantId: string;
  servedBy: string | null;
  customerName: string;
  paymentMethod: 'pix' | 'cash' | 'credit_card' | 'debit_card' | 'wristband';
  items: QuickSaleCartItem[];
  total: number;
  /** Wristband (pulseira) data — when present, item goes to bar pickup queue */
  wristbandId?: string | null;
  wristbandCode?: string | null;
  /** When true, payment is deferred (cliente paga ao fechar pulseira) */
  postPaid?: boolean;
}

const generatePickupCode = () => {
  // Short human-friendly pickup token like "B-X9K"
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 3; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return `B-${s}`;
};

/**
 * Insert a quick-sale order (type=quick_sale) and items in Supabase.
 * Returns true on success, false on failure.
 */
export async function insertQuickSale(payload: QuickSalePayload): Promise<boolean> {
  const hasWristband = !!payload.wristbandId;
  const postPaid = payload.postPaid && hasWristband;
  const pickupCode = hasWristband ? generatePickupCode() : null;

  const orderRow: any = {
    restaurant_id: payload.restaurantId,
    type: 'quick_sale',
    customer_name: payload.wristbandCode ? `Pulseira ${payload.wristbandCode}` : (payload.customerName || 'Cliente'),
    subtotal: payload.total,
    total: payload.total,
    status: hasWristband ? 'preparing' : 'completed',
    payment_method: postPaid ? null : payload.paymentMethod,
    payment_status: postPaid ? 'pending' : 'paid',
    served_by: payload.servedBy,
    wristband_id: payload.wristbandId || null,
    wristband_code: payload.wristbandCode || null,
    bar_status: hasWristband ? 'pending' : null,
    bar_pickup_code: pickupCode,
  };

  const { data: order, error: orderErr } = await (supabase as any)
    .from('orders')
    .insert(orderRow)
    .select()
    .single();

  if (orderErr || !order) return false;

  const itemsPayload = payload.items.map((it) => ({
    order_id: order.id,
    product_id: it.productId,
    name: it.name,
    qty: it.qty,
    unit_price: it.unitPrice,
    total_price: it.totalPrice,
  }));
  const { error: itemsErr } = await (supabase as any)
    .from('order_items')
    .insert(itemsPayload);

  if (itemsErr) return false;
  return true;
}

/** Fetches quick-sale stats for "today" — used in the live dashboard. */
export function useQuickSaleStats() {
  const { restaurantId } = useAuth();
  return useQuery({
    queryKey: ['quick-sale-stats', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: orders } = await (supabase as any)
        .from('orders')
        .select('id, total, served_by, created_at, order_items(product_id, name, qty)')
        .eq('restaurant_id', restaurantId)
        .eq('type', 'quick_sale')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });

      const list = (orders || []) as any[];
      const totalRevenue = list.reduce((s, o) => s + Number(o.total || 0), 0);
      const totalSales = list.length;

      const perServer: Record<string, { count: number; total: number }> = {};
      for (const o of list) {
        const k = o.served_by || 'unknown';
        if (!perServer[k]) perServer[k] = { count: 0, total: 0 };
        perServer[k].count += 1;
        perServer[k].total += Number(o.total || 0);
      }

      const perProduct: Record<string, { name: string; qty: number }> = {};
      for (const o of list) {
        for (const it of (o.order_items || [])) {
          const k = it.product_id || it.name;
          if (!perProduct[k]) perProduct[k] = { name: it.name, qty: 0 };
          perProduct[k].qty += it.qty;
        }
      }

      const now = Date.now();
      const buckets: number[] = new Array(30).fill(0);
      for (const o of list) {
        const diffMin = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
        if (diffMin >= 0 && diffMin < 30) buckets[29 - diffMin] += 1;
      }

      return {
        totalRevenue,
        totalSales,
        perServer,
        topProducts: Object.values(perProduct).sort((a, b) => b.qty - a.qty).slice(0, 10),
        salesPerMinute: buckets,
        recent: list.slice(0, 20),
      };
    },
    enabled: !!restaurantId,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });
}

/** Fetches the names (full_name) for a list of user_ids (for the ranking). */
export function useStaffNames(userIds: string[]) {
  return useQuery({
    queryKey: ['staff-names', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, string>;
      const { data } = await (supabase as any)
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = p.full_name || 'Garçom';
      });
      return map;
    },
    enabled: userIds.length > 0,
  });
}
