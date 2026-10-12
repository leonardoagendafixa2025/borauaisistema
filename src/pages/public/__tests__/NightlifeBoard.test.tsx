import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NightlifeBoard from '../NightlifeBoard';

// ============================================================================
// MOCKS
// ============================================================================

// Mock publicSupabase: returns the restaurant by slug + products
vi.mock('@/integrations/supabase/public-client', () => {
  const restaurant = {
    id: 'rest-1',
    name: 'Boteco do Zé',
    logo_url: null,
    slug: 'boteco-do-ze',
  };

  const products = [
    { id: 'prod-1', name: 'Caipirinha de Maracujá', image_url: null, price: 32.9 },
  ];

  const buildQuery = (table: string) => {
    const state: any = { table, filters: {} };
    const chain: any = {
      select: () => chain,
      eq: (col: string, val: any) => {
        state.filters[col] = val;
        return chain;
      },
      order: () => chain,
      in: (col: string, vals: any[]) => {
        state.filters[`${col}__in`] = vals;
        return chain;
      },
      maybeSingle: async () => {
        if ((table === 'restaurants' || table === 'restaurants_public') && state.filters.slug === 'boteco-do-ze') {
          return { data: restaurant, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve: any) => {
        if (table === 'products') {
          const ids: string[] = state.filters.id__in || [];
          return Promise.resolve({
            data: products.filter((p) => ids.includes(p.id)),
            error: null,
          }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return chain;
  };

  return {
    publicSupabase: {
      from: (table: string) => buildQuery(table),
      channel: () => ({
        on: function () {
          return this;
        },
        subscribe: function () {
          return this;
        },
      }),
      removeChannel: () => {},
    },
  };
});

// Mock the nightlife hook with controllable data
const nightlifeData: any = { acts: [], drinks: [] };
vi.mock('@/hooks/useNightlife', () => ({
  usePublicNightlife: () => ({ data: nightlifeData, isLoading: false }),
}));

// Mock public settings
vi.mock('@/hooks/useRestaurantData', () => ({
  usePublicSettings: () => ({
    data: { music_requests_enabled: false, music_requests_price: 0 },
  }),
}));

// Mock music request component (not under test here)
vi.mock('@/components/nightlife/PublicMusicRequest', () => ({
  default: () => <div data-testid="music-request">music-request</div>,
}));

// ============================================================================
// HELPERS
// ============================================================================

function renderBoard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/boteco-do-ze/balada']}>
        <Routes>
          <Route path="/:slug/balada" element={<NightlifeBoard />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const NOW = new Date('2026-05-01T23:30:00Z').getTime();

function setData(opts: { acts?: any[]; drinks?: any[] }) {
  nightlifeData.acts = opts.acts || [];
  nightlifeData.drinks = opts.drinks || [];
}

beforeEach(() => {
  // Freeze Date.now without faking timers (React Query needs real timers)
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  setData({ acts: [], drinks: [] });
});

// ============================================================================
// TESTS
// ============================================================================

describe('NightlifeBoard /:slug/balada', () => {
  it('renderiza o cabeçalho da rota com o nome do restaurante', async () => {
    renderBoard();
    await waitFor(() => {
      expect(screen.getAllByText('Boteco do Zé').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/A Noite/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Tocando agora/i)).toBeInTheDocument();
    expect(screen.getByText(/Drink da Hora/i)).toBeInTheDocument();
  });

  it('mostra estados vazios quando o tenant não tem programação', async () => {
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma atração no ar agora/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Nenhuma promo ativa no momento/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Sem programação cadastrada para esta noite/i),
    ).toBeInTheDocument();
  });

  it('exibe o ato que está tocando agora (line-up ao vivo)', async () => {
    setData({
      acts: [
        {
          id: 'a1',
          artist_name: 'DJ Lê Costa',
          genre: 'House',
          description: 'Set ao vivo',
          image_url: null,
          starts_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
          ends_at: new Date(NOW + 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText('DJ Lê Costa')).toBeInTheDocument();
    });
    expect(screen.getByText('House')).toBeInTheDocument();
    expect(screen.getByText(/Termina em/i)).toBeInTheDocument();
  });

  it('exibe o drink da hora ativo com preço promocional', async () => {
    setData({
      drinks: [
        {
          id: 'd1',
          product_id: 'prod-1',
          custom_name: null,
          custom_image_url: null,
          promo_price: 9,
          highlight_text: 'METADE DO PREÇO',
          starts_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
          ends_at: new Date(NOW + 30 * 60 * 1000).toISOString(),
        },
      ],
    });
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText(/R\$\s?9,00/)).toBeInTheDocument();
    });
    expect(screen.getByText(/METADE DO PREÇO/i)).toBeInTheDocument();
    expect(screen.getByText(/Acaba em/i)).toBeInTheDocument();
  });

  it('lista os próximos sets quando há atos futuros', async () => {
    setData({
      acts: [
        {
          id: 'a1',
          artist_name: 'DJ Lê Costa',
          genre: null,
          description: null,
          image_url: null,
          starts_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
          ends_at: new Date(NOW + 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'a2',
          artist_name: 'Banda Pé na Estrada',
          genre: 'Sertanejo',
          description: null,
          image_url: null,
          starts_at: new Date(NOW + 2 * 60 * 60 * 1000).toISOString(),
          ends_at: new Date(NOW + 4 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'a3',
          artist_name: 'DJ Marcão',
          genre: null,
          description: null,
          image_url: null,
          starts_at: new Date(NOW + 5 * 60 * 60 * 1000).toISOString(),
          ends_at: new Date(NOW + 7 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText(/Próximos sets/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Banda Pé na Estrada')).toBeInTheDocument();
    expect(screen.getByText('DJ Marcão')).toBeInTheDocument();
  });

  it('quando não há ato tocando, mostra a próxima atração com countdown', async () => {
    setData({
      acts: [
        {
          id: 'a1',
          artist_name: 'After Set — DJ Bia',
          genre: null,
          description: null,
          image_url: null,
          starts_at: new Date(NOW + 30 * 60 * 1000).toISOString(),
          ends_at: new Date(NOW + 90 * 60 * 1000).toISOString(),
        },
      ],
    });
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma atração no ar agora/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Próxima:/i)).toBeInTheDocument();
    expect(screen.getAllByText('After Set — DJ Bia').length).toBeGreaterThan(0);
  });
});
