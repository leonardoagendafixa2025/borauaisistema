import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDb, type PendingOrder, type PendingCommand, type PendingQuickSale } from '@/lib/offlineDb';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from 'sonner';

async function syncQuickSale(item: PendingQuickSale) {
  await offlineDb.pendingQuickSales.update(item.id!, { status: 'syncing' });
  const { data: order, error: orderErr } = await (supabase as any)
    .from('orders')
    .insert({
      restaurant_id: item.restaurantId,
      type: 'quick_sale',
      customer_name: item.customerName,
      subtotal: item.total,
      total: item.total,
      status: 'completed',
      payment_method: item.paymentMethod,
      payment_status: 'paid',
      served_by: item.servedBy,
    })
    .select()
    .single();

  if (orderErr || !order) {
    await offlineDb.pendingQuickSales.update(item.id!, {
      status: 'failed',
      attempts: item.attempts + 1,
      lastError: orderErr?.message || 'Erro desconhecido',
    });
    return false;
  }

  const itemsPayload = item.items.map((it) => ({
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

  if (itemsErr) {
    await offlineDb.pendingQuickSales.update(item.id!, {
      status: 'failed',
      attempts: item.attempts + 1,
      lastError: itemsErr.message,
    });
    return false;
  }

  await offlineDb.pendingQuickSales.delete(item.id!);
  return true;
}

async function syncCommand(item: PendingCommand) {
  await offlineDb.pendingCommands.update(item.id!, { status: 'syncing' });
  const { data, error } = await (supabase as any)
    .from('table_commands')
    .insert({
      restaurant_id: item.restaurantId,
      table_id: item.tableId,
      customer_name: item.customerName,
    })
    .select()
    .single();
  if (error || !data) {
    await offlineDb.pendingCommands.update(item.id!, {
      status: 'failed',
      attempts: item.attempts + 1,
    });
    return null;
  }
  await offlineDb.pendingCommands.delete(item.id!);
  return data.id as string;
}

async function syncOrder(item: PendingOrder) {
  await offlineDb.pendingOrders.update(item.id!, { status: 'syncing' });
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      restaurant_id: item.restaurantId,
      table_id: item.tableId,
      type: 'dine_in' as any,
      customer_name: item.customerName,
      subtotal: item.subtotal,
      total: item.total,
      notes: item.notes || null,
      served_by: item.servedBy || null,
      status: 'new' as any,
    })
    .select()
    .single();

  if (orderErr || !order) {
    await offlineDb.pendingOrders.update(item.id!, {
      status: 'failed',
      attempts: item.attempts + 1,
      lastError: orderErr?.message || 'Erro desconhecido',
    });
    return false;
  }

  const itemsPayload = item.items.map((it) => ({
    order_id: order.id,
    product_id: it.productId,
    name: it.name,
    qty: it.qty,
    unit_price: it.unitPrice,
    total_price: it.totalPrice,
    notes: it.notes || null,
    command_id: item.commandId,
  }));
  const { error: itemsErr } = await (supabase as any)
    .from('order_items')
    .insert(itemsPayload);

  if (itemsErr) {
    await offlineDb.pendingOrders.update(item.id!, {
      status: 'failed',
      attempts: item.attempts + 1,
      lastError: itemsErr.message,
    });
    return false;
  }

  await offlineDb.pendingOrders.delete(item.id!);
  return true;
}

export function useOfflineSync() {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const syncing = useRef(false);

  const pendingOrders = useLiveQuery(() => offlineDb.pendingOrders.toArray(), []) ?? [];
  const pendingCommands = useLiveQuery(() => offlineDb.pendingCommands.toArray(), []) ?? [];
  const pendingQuickSales = useLiveQuery(() => offlineDb.pendingQuickSales.toArray(), []) ?? [];

  useEffect(() => {
    if (!online || syncing.current) return;
    if (
      pendingOrders.length === 0 &&
      pendingCommands.length === 0 &&
      pendingQuickSales.length === 0
    ) return;

    (async () => {
      syncing.current = true;
      let successCount = 0;
      let failCount = 0;

      // Sync commands first (orders may depend on them)
      for (const cmd of pendingCommands) {
        if (cmd.status === 'syncing') continue;
        const newId = await syncCommand(cmd);
        if (newId) {
          successCount++;
          // Update any pending orders that referenced this local command id
          const ordersToUpdate = await offlineDb.pendingOrders
            .where('status')
            .anyOf(['pending', 'failed'])
            .toArray();
          for (const ord of ordersToUpdate) {
            if (ord.commandId === cmd.localId) {
              await offlineDb.pendingOrders.update(ord.id!, { commandId: newId });
            }
          }
        } else {
          failCount++;
        }
      }

      // Then sync orders
      for (const ord of pendingOrders) {
        if (ord.status === 'syncing') continue;
        // Skip if commandId still references an unsynced local command
        if (ord.commandId && ord.commandId.startsWith('local_')) continue;
        const ok = await syncOrder(ord);
        if (ok) successCount++;
        else failCount++;
      }

      // Then sync quick sales
      for (const qs of pendingQuickSales) {
        if (qs.status === 'syncing') continue;
        const ok = await syncQuickSale(qs);
        if (ok) successCount++;
        else failCount++;
      }

      if (successCount > 0) {
        toast.success(`${successCount} ${successCount === 1 ? 'item sincronizado' : 'itens sincronizados'}`);
        queryClient.invalidateQueries();
      }
      if (failCount > 0) {
        toast.error(`${failCount} ${failCount === 1 ? 'item falhou' : 'itens falharam'} ao sincronizar`);
      }
      syncing.current = false;
    })();
  }, [online, pendingOrders, pendingCommands, pendingQuickSales, queryClient]);

  return {
    online,
    pendingCount: pendingOrders.length + pendingCommands.length + pendingQuickSales.length,
    pendingOrders,
    pendingCommands,
    pendingQuickSales,
  };
}
