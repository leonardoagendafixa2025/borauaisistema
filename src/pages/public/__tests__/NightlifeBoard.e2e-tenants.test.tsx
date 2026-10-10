/**
 * E2E Test — /:slug/balada multi-tenant URL switching
 *
 * Cenário coberto:
 *   1. Cliente acessa /boteco-do-ze/balada → vê SOMENTE o line-up e drinks do Boteco do Zé.
 *   2. Cliente troca a URL para /bar-da-luana/balada → vê SOMENTE o line-up e drinks do Bar da Luana.
 *   3. Em nenhum momento dados de um tenant aparecem ao visualizar o outro.
 *
 * Estratégia:
 *   - Mock do publicSupabase com dois restaurantes distintos (slug → id).
 *   - Mock de usePublicNightlife que filtra por restaurantId real (rejeita IDs cruzados).
 *   - Renderiza o componente, desmonta, re-renderiza com novo slug e valida isolamento.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NightlifeBoard from '../NightlifeBoard';

// ============================================================================
// FIXTURES — dois tenants completamente distintos
// ============================================================================

const TENANTS = {
  'boteco-do-ze': {
    id: 'rest-boteco',
    name: 'Boteco do Zé',
    logo_url: null,
    slug: 'boteco-do-ze',
  },
  'bar-da-luana': {
    id: 'rest-luana',
    name: 'Bar da Luana',
    logo_url: null,
    slug: 'bar-da-luana',
  },
};

const NOW = new Date('2026-05-01T23:30:00Z').getTime();

const ACTS_BY_TENANT: Record<string, any[]> = {
  'rest-boteco': [
    {
      id: 'act-boteco-live',
      artist_name: 'DJ Zé do Boteco',
      genre: 'Samba Rock',
      description: null,
      image_url: null,
      starts_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
      ends_at: new Date(NOW + 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-boteco-next',
      artist_name: 'Banda Pé na Estrada',
      genre: 'Sertanejo',
      description: null,
      image_url: null,
      starts_at: new Date(NOW + 2 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(NOW + 4 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'rest-luana': [
    {
      id: 'act-luana-live',
      artist_name: 'Luana Acústico',
      genre: 'MPB',
      description: null,
      image_url: null,
      starts_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
      ends_at: new Date(NOW + 90 * 60 * 1000).toISOString(),
    },
  ],
};

const DRINKS_BY_TENANT: Record<string, any[]> = {
  'rest-boteco': [
    {
      id: 'drink-boteco',
      product_id: null,
      custom_name: 'Caipirinha de Maracujá',
      custom_image_url: null,
      promo_price: 9,
      highlight_text: 'BOTECO PROMO',
      starts_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
      ends_at: new Date(NOW + 30 * 60 * 1000).toISOString(),
    },
  ],
  'rest-luana': [
    {
      id: 'drink-luana',
      product_id: null,
      custom_name: 'Gin Tônica de Pepino',
      custom_image_url: null,
      promo_price: 18,
      highlight_text: 'LUANA HOUR',
      starts_at: new Date(NOW - 15 * 60 * 1000).toISOString(),
      ends_at: new Date(NOW + 45 * 60 * 1000).toISOString(),
    },
  ],
};

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/integrations/supabase/public-client', () => {
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
        if (table === 'restaurants') {
          const slug = state.filters.slug;
          const t = (TENANTS as any)[slug];
          return { data: t || null, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve: any) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
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

// CRÍTICO: o hook DEVE filtrar por restaurantId — se o ID for desconhecido,
// retorna vazio. Isso simula a barreira de RLS no banco.
vi.mock('@/hooks/useNightlife', () => ({
  usePublicNightlife: (restaurantId?: string) => {
    if (!restaurantId) {
      return { data: { acts: [], drinks: [] }, isLoading: false };
    }
    return {
      data: {
        acts: ACTS_BY_TENANT[restaurantId] || [],
        drinks: DRINKS_BY_TENANT[restaurantId] || [],
      },
      isLoading: false,
    };
  },
}));

vi.mock('@/hooks/useRestaurantData', () => ({
  usePublicSettings: () => ({
    data: { music_requests_enabled: false, music_requests_price: 0 },
  }),
}));

vi.mock('@/components/nightlife/PublicMusicRequest', () => ({
  default: () => <div data-testid="music-request">music-request</div>,
}));

// ============================================================================
// HELPERS
// ============================================================================

function renderAtSlug(slug: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/${slug}/balada`]}>
        <Routes>
          <Route path="/:slug/balada" element={<NightlifeBoard />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

// ============================================================================
// TESTS
// ============================================================================

describe('E2E /:slug/balada — isolamento entre tenants ao trocar URL', () => {
  it('Boteco do Zé exibe APENAS seu próprio line-up e drink', async () => {
    renderAtSlug('boteco-do-ze');

    await waitFor(() => {
      expect(screen.getByText('DJ Zé do Boteco')).toBeInTheDocument();
    });

    // Conteúdo do tenant correto
    expect(screen.getByText('Samba Rock')).toBeInTheDocument();
    expect(screen.getByText('Caipirinha de Maracujá')).toBeInTheDocument();
    expect(screen.getByText(/BOTECO PROMO/i)).toBeInTheDocument();
    expect(screen.getByText('Banda Pé na Estrada')).toBeInTheDocument();

    // ZERO vazamento do outro tenant
    expect(screen.queryByText('Luana Acústico')).not.toBeInTheDocument();
    expect(screen.queryByText('Gin Tônica de Pepino')).not.toBeInTheDocument();
    expect(screen.queryByText(/LUANA HOUR/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Bar da Luana')).not.toBeInTheDocument();
  });

  it('Bar da Luana exibe APENAS seu próprio line-up e drink', async () => {
    renderAtSlug('bar-da-luana');

    await waitFor(() => {
      expect(screen.getByText('Luana Acústico')).toBeInTheDocument();
    });

    expect(screen.getByText('MPB')).toBeInTheDocument();
    expect(screen.getByText('Gin Tônica de Pepino')).toBeInTheDocument();
    expect(screen.getByText(/LUANA HOUR/i)).toBeInTheDocument();

    // ZERO vazamento do Boteco
    expect(screen.queryByText('DJ Zé do Boteco')).not.toBeInTheDocument();
    expect(screen.queryByText('Caipirinha de Maracujá')).not.toBeInTheDocument();
    expect(screen.queryByText('Banda Pé na Estrada')).not.toBeInTheDocument();
    expect(screen.queryByText(/BOTECO PROMO/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Boteco do Zé')).not.toBeInTheDocument();
  });

  it('alterna entre os dois tenants via URL sem vazar dados entre as visualizações', async () => {
    // 1ª visita: Boteco
    renderAtSlug('boteco-do-ze');
    await waitFor(() => {
      expect(screen.getByText('DJ Zé do Boteco')).toBeInTheDocument();
    });
    expect(screen.getByText(/BOTECO PROMO/i)).toBeInTheDocument();

    // Desmonta (simula navegação para outra URL)
    cleanup();

    // 2ª visita: Luana — deve ver SÓ os dados dela
    renderAtSlug('bar-da-luana');
    await waitFor(() => {
      expect(screen.getByText('Luana Acústico')).toBeInTheDocument();
    });
    expect(screen.getByText(/LUANA HOUR/i)).toBeInTheDocument();

    // Conteúdo do Boteco NÃO pode estar mais presente
    expect(screen.queryByText('DJ Zé do Boteco')).not.toBeInTheDocument();
    expect(screen.queryByText(/BOTECO PROMO/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Caipirinha de Maracujá')).not.toBeInTheDocument();

    // Volta pro Boteco — não pode trazer resíduo da Luana
    cleanup();
    renderAtSlug('boteco-do-ze');
    await waitFor(() => {
      expect(screen.getByText('DJ Zé do Boteco')).toBeInTheDocument();
    });
    expect(screen.queryByText('Luana Acústico')).not.toBeInTheDocument();
    expect(screen.queryByText('Gin Tônica de Pepino')).not.toBeInTheDocument();
    expect(screen.queryByText(/LUANA HOUR/i)).not.toBeInTheDocument();
  });

  it('slug inexistente não exibe dados de nenhum tenant', async () => {
    renderAtSlug('restaurante-fantasma');

    await waitFor(() => {
      expect(
        screen.getByText(/Sem programação cadastrada para esta noite/i),
      ).toBeInTheDocument();
    });

    // Nada de nenhum tenant pode aparecer
    expect(screen.queryByText('DJ Zé do Boteco')).not.toBeInTheDocument();
    expect(screen.queryByText('Luana Acústico')).not.toBeInTheDocument();
    expect(screen.queryByText('Caipirinha de Maracujá')).not.toBeInTheDocument();
    expect(screen.queryByText('Gin Tônica de Pepino')).not.toBeInTheDocument();
  });
});
