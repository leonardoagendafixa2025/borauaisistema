import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ============================================================================
// MULTI-TENANT FIXTURES
// Two separate restaurants, each with its own acts + drinks.
// We assert that querying with restaurant A's ID NEVER returns restaurant B's
// rows (and vice-versa), even when both datasets exist in the "DB".
// ============================================================================

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const ALL_ACTS = [
  { id: 'act-a1', restaurant_id: TENANT_A, artist_name: 'DJ A1', active: true,  starts_at: '2026-05-01T22:00:00Z', ends_at: '2026-05-02T00:00:00Z' },
  { id: 'act-a2', restaurant_id: TENANT_A, artist_name: 'DJ A2', active: true,  starts_at: '2026-05-02T00:00:00Z', ends_at: '2026-05-02T02:00:00Z' },
  { id: 'act-a3', restaurant_id: TENANT_A, artist_name: 'DJ A3', active: false, starts_at: '2026-05-02T02:00:00Z', ends_at: '2026-05-02T04:00:00Z' },
  { id: 'act-b1', restaurant_id: TENANT_B, artist_name: 'DJ B1', active: true,  starts_at: '2026-05-01T22:00:00Z', ends_at: '2026-05-02T00:00:00Z' },
  { id: 'act-b2', restaurant_id: TENANT_B, artist_name: 'DJ B2', active: true,  starts_at: '2026-05-02T00:00:00Z', ends_at: '2026-05-02T02:00:00Z' },
];

const ALL_DRINKS = [
  { id: 'd-a1', restaurant_id: TENANT_A, custom_name: 'Caipira A', active: true,  promo_price: 10, starts_at: '2026-05-01T22:00:00Z', ends_at: '2026-05-02T00:00:00Z' },
  { id: 'd-a2', restaurant_id: TENANT_A, custom_name: 'Cerveja A', active: false, promo_price: 8,  starts_at: '2026-05-02T00:00:00Z', ends_at: '2026-05-02T02:00:00Z' },
  { id: 'd-b1', restaurant_id: TENANT_B, custom_name: 'Gin B',     active: true,  promo_price: 15, starts_at: '2026-05-01T22:00:00Z', ends_at: '2026-05-02T00:00:00Z' },
];

// Shared spy state to assert filters applied
const lastQuery: { table?: string; filters?: Record<string, any> } = {};

// Mock public-client BEFORE importing the hook
vi.mock('@/integrations/supabase/public-client', () => {
  function buildChain(table: string) {
    const filters: Record<string, any> = {};
    const chain: any = {
      select: () => chain,
      eq: (col: string, val: any) => {
        filters[col] = val;
        return chain;
      },
      order: () => chain,
      // Async resolution: thenable so `await` triggers the query
      then: (resolve: any, reject: any) => {
        // Record last call (test asserts on these)
        lastQuery.table = table;
        lastQuery.filters = { ...filters };

        // Strict tenant filter enforcement (mirrors RLS + .eq('restaurant_id', ...))
        const dataset =
          table === 'nightlife_acts' ? ALL_ACTS :
          table === 'nightlife_hour_drinks' ? ALL_DRINKS : [];

        const filtered = dataset.filter((row: any) => {
          for (const [k, v] of Object.entries(filters)) {
            if (row[k] !== v) return false;
          }
          return true;
        });

        return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    publicSupabase: {
      from: (table: string) => buildChain(table),
      channel: () => ({
        on() { return this; },
        subscribe() { return this; },
      }),
      removeChannel: () => {},
    },
  };
});

// Import AFTER mocks
import { usePublicNightlife } from '@/hooks/useNightlife';

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  lastQuery.table = undefined;
  lastQuery.filters = undefined;
});

describe('usePublicNightlife — multi-tenant isolation', () => {
  it('só retorna acts/drinks do tenant A quando consultado com TENANT_A', async () => {
    const { result } = renderHook(() => usePublicNightlife(TENANT_A), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const acts = result.current.data?.acts || [];
    const drinks = result.current.data?.drinks || [];

    // All returned rows belong to tenant A
    expect(acts.length).toBeGreaterThan(0);
    expect(drinks.length).toBeGreaterThan(0);
    expect(acts.every((a) => a.restaurant_id === TENANT_A)).toBe(true);
    expect(drinks.every((d) => d.restaurant_id === TENANT_A)).toBe(true);

    // Zero leak from tenant B
    expect(acts.some((a) => a.restaurant_id === TENANT_B)).toBe(false);
    expect(drinks.some((d) => d.restaurant_id === TENANT_B)).toBe(false);

    // Inactive rows must be filtered out (active=true)
    expect(acts.every((a) => a.active === true)).toBe(true);
    expect(drinks.every((d) => d.active === true)).toBe(true);
    expect(acts.find((a) => a.id === 'act-a3')).toBeUndefined(); // inactive A
    expect(drinks.find((d) => d.id === 'd-a2')).toBeUndefined(); // inactive A
  });

  it('só retorna acts/drinks do tenant B quando consultado com TENANT_B', async () => {
    const { result } = renderHook(() => usePublicNightlife(TENANT_B), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const acts = result.current.data?.acts || [];
    const drinks = result.current.data?.drinks || [];

    expect(acts.every((a) => a.restaurant_id === TENANT_B)).toBe(true);
    expect(drinks.every((d) => d.restaurant_id === TENANT_B)).toBe(true);
    expect(acts.some((a) => a.restaurant_id === TENANT_A)).toBe(false);
    expect(drinks.some((d) => d.restaurant_id === TENANT_A)).toBe(false);

    // Specific tenant-B IDs present
    expect(acts.map((a) => a.id).sort()).toEqual(['act-b1', 'act-b2']);
    expect(drinks.map((d) => d.id)).toEqual(['d-b1']);
  });

  it('aplica filtro restaurant_id E active=true na query (defesa em profundidade)', async () => {
    const { result } = renderHook(() => usePublicNightlife(TENANT_A), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Must include both filters — never query without restaurant_id
    expect(lastQuery.filters?.restaurant_id).toBe(TENANT_A);
    expect(lastQuery.filters?.active).toBe(true);
  });

  it('retorna vazio (sem disparar query) quando restaurantId é null/undefined', async () => {
    const { result } = renderHook(() => usePublicNightlife(null), { wrapper: wrapper() });
    // enabled=false → never loads
    await waitFor(() => {
      // data stays undefined; nothing should have been queried
      expect(lastQuery.table).toBeUndefined();
    });
    expect(result.current.data).toBeUndefined();
  });

  it('cache do React Query é segregado por tenant (chaves diferentes)', async () => {
    const w = wrapper();

    const { result: rA } = renderHook(() => usePublicNightlife(TENANT_A), { wrapper: w });
    await waitFor(() => expect(rA.current.isLoading).toBe(false));

    const { result: rB } = renderHook(() => usePublicNightlife(TENANT_B), { wrapper: w });
    await waitFor(() => expect(rB.current.isLoading).toBe(false));

    // Both must hold tenant-specific data simultaneously without bleed
    expect(rA.current.data?.acts.every((a) => a.restaurant_id === TENANT_A)).toBe(true);
    expect(rB.current.data?.acts.every((a) => a.restaurant_id === TENANT_B)).toBe(true);
    expect(rA.current.data?.drinks.every((d) => d.restaurant_id === TENANT_A)).toBe(true);
    expect(rB.current.data?.drinks.every((d) => d.restaurant_id === TENANT_B)).toBe(true);
  });
});
