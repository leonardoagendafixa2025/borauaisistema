import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { offlineDb, generateLocalId, type DashboardAction, type CachedRow } from '@/lib/offlineDb';
import { toast } from 'sonner';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type DashTable = DashboardAction['table'];

interface EnqueueArgs {
  table: DashTable;
  rowId: string;
  patch: Record<string, any>;
  follow?: DashboardAction['follow'];
  label?: string;
}

/**
 * Persist rows from the dashboard's React Query cache to IndexedDB so the
 * page can render with last-known data after a hard refresh while offline.
 */
async function snapshotRows(
  restaurantId: string,
  table: CachedRow['table'],
  rows: any[],
) {
  if (!rows || rows.length === 0) return;
  const now = Date.now();
  const records: CachedRow[] = rows.map(r => ({
    key: `${table}:${r.id}`,
    table,
    restaurantId,
    rowId: r.id,
    data: r,
    cachedAt: now,
  }));
  try {
    await offlineDb.cachedRows.bulkPut(records);
  } catch (e) {
    console.warn('[offline] snapshot failed', e);
  }
}

async function pruneStale() {
  const cutoff = Date.now() - CACHE_TTL_MS;
  try {
    await offlineDb.cachedRows.where('cachedAt').below(cutoff).delete();
  } catch {}
}

/** Apply a queued action against Supabase. Last-write-wins (no version checks). */
async function applyAction(action: DashboardAction): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any)
      .from(action.table)
      .update(action.patch)
      .eq('id', action.rowId);
    if (error) return { ok: false, error: error.message };

    if (action.follow) {
      const { error: e2 } = await (supabase as any)
        .from(action.follow.table)
        .update(action.follow.patch)
        .eq('id', action.follow.rowId);
      if (e2) return { ok: false, error: e2.message };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' };
  }
}

/**
 * Offline mode for the Operations Center.
 *
 * - `enqueue`: tenta executar o update direto. Se offline (ou falhar com erro
 *   de rede), grava na fila Dexie. Reconciliação automática ao voltar online.
 * - `snapshot`: persiste 24h de pedidos/chamadas/configurações em IndexedDB
 *   para a página renderizar mesmo após F5 sem internet.
 * - `getCached`: lê snapshot por tabela, mesclando com patches pendentes
 *   (preview otimista local).
 */
export function useDashboardOffline() {
  const { restaurantId } = useAuth();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const syncing = useRef(false);

  const pendingActions = useLiveQuery(
    () => restaurantId
      ? offlineDb.dashboardActions.where('restaurantId').equals(restaurantId).toArray()
      : Promise.resolve([] as DashboardAction[]),
    [restaurantId],
  ) ?? [];

  const enqueue = useCallback(async (args: EnqueueArgs): Promise<{ queued: boolean; error?: string }> => {
    if (!restaurantId) return { queued: false, error: 'no restaurant' };

    // Try direct first when online — keeps the happy path identical to the old flow.
    if (online) {
      const res = await applyAction({
        id: undefined,
        localId: generateLocalId(),
        restaurantId,
        table: args.table,
        rowId: args.rowId,
        patch: args.patch,
        follow: args.follow,
        label: args.label,
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
      });
      if (res.ok) return { queued: false };
      // Network/transient errors → fall through to queue. Auth/RLS errors → bubble up.
      const transient = !res.error || /fetch|network|timeout|failed to fetch|offline/i.test(res.error);
      if (!transient) return { queued: false, error: res.error };
    }

    await offlineDb.dashboardActions.add({
      localId: generateLocalId(),
      restaurantId,
      table: args.table,
      rowId: args.rowId,
      patch: args.patch,
      follow: args.follow,
      label: args.label,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
    });
    return { queued: true };
  }, [restaurantId, online]);

  // Background sync when reconnecting
  useEffect(() => {
    if (!online || !restaurantId || syncing.current || pendingActions.length === 0) return;

    (async () => {
      syncing.current = true;
      let ok = 0; let fail = 0;
      for (const a of pendingActions) {
        if (a.status === 'syncing') continue;
        await offlineDb.dashboardActions.update(a.id!, { status: 'syncing' });
        const res = await applyAction(a);
        if (res.ok) {
          await offlineDb.dashboardActions.delete(a.id!);
          ok++;
        } else {
          await offlineDb.dashboardActions.update(a.id!, {
            status: 'failed',
            attempts: a.attempts + 1,
            lastError: res.error,
          });
          fail++;
          // Drop after 5 attempts to avoid infinite retries on permanent errors.
          if (a.attempts + 1 >= 5) {
            await offlineDb.dashboardActions.delete(a.id!);
            toast.error(`Ação descartada após 5 tentativas: ${a.label || a.table}`);
          }
        }
      }
      if (ok > 0) {
        toast.success(`${ok} ${ok === 1 ? 'ação sincronizada' : 'ações sincronizadas'}`);
        queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['waiter_calls', restaurantId] });
        queryClient.invalidateQueries({ queryKey: ['restaurant_settings', restaurantId] });
      }
      if (fail > 0) toast.warning(`${fail} ${fail === 1 ? 'ação aguardando retry' : 'ações aguardando retry'}`);
      syncing.current = false;
    })();
  }, [online, restaurantId, pendingActions, queryClient]);

  // Periodic prune of stale snapshots
  useEffect(() => { pruneStale(); }, []);

  const snapshot = useCallback((table: CachedRow['table'], rows: any[]) => {
    if (!restaurantId) return;
    snapshotRows(restaurantId, table, rows);
  }, [restaurantId]);

  const getCachedSync = useCallback(async <T = any>(table: CachedRow['table']): Promise<T[]> => {
    if (!restaurantId) return [];
    const rows = await offlineDb.cachedRows
      .where('[table+restaurantId]')
      .equals([table, restaurantId])
      .toArray()
      .catch(() => [] as CachedRow[]);
    // Index `[table+restaurantId]` may not exist — fall back to scan if so.
    if (rows.length === 0) {
      const all = await offlineDb.cachedRows.where('restaurantId').equals(restaurantId).toArray();
      return all.filter(r => r.table === table).map(r => r.data as T);
    }
    return rows.map(r => r.data as T);
  }, [restaurantId]);

  /** Apply pending patches over a fresh row list to give an optimistic view. */
  const overlayPending = useCallback(<T extends { id: string }>(table: DashTable, rows: T[]): T[] => {
    if (pendingActions.length === 0) return rows;
    const map = new Map(rows.map(r => [r.id, { ...r }]));
    for (const a of pendingActions) {
      if (a.table !== table) continue;
      const cur = map.get(a.rowId);
      if (cur) map.set(a.rowId, { ...cur, ...a.patch });
    }
    return Array.from(map.values());
  }, [pendingActions]);

  const pendingCount = pendingActions.length;

  return useMemo(() => ({
    online,
    pendingCount,
    pendingActions,
    enqueue,
    snapshot,
    getCachedSync,
    overlayPending,
  }), [online, pendingCount, pendingActions, enqueue, snapshot, getCachedSync, overlayPending]);
}
