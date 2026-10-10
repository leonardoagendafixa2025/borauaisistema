import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Music, Sparkles, Clock, ArrowLeft, Beer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { usePublicNightlife } from '@/hooks/useNightlife';
import { usePublicSettings } from '@/hooks/useRestaurantData';
import PublicMusicRequest from '@/components/nightlife/PublicMusicRequest';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function useTick(intervalMs = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const i = setInterval(() => set((x) => x + 1), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
}

function formatRemaining(ms: number) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function NightlifeBoard() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const mesa = searchParams.get('mesa');
  const backHref = mesa ? `/${slug}/mesa/${mesa}` : `/${slug}`;
  const backLabel = mesa ? `Voltar para a mesa ${mesa}` : 'Voltar ao cardápio';
  useTick(1000);

  const { data: restaurant } = useQuery({
    queryKey: ['public-restaurant-by-slug', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await (publicSupabase as any)
        .from('restaurants_public')
        .select('id, name, logo_url, slug')
        .eq('slug', slug)
        .maybeSingle();
      return data as any;
    },
    enabled: !!slug,
  });

  const restaurantId = restaurant?.id;
  const { data, isLoading } = usePublicNightlife(restaurantId);
  const { data: settings } = usePublicSettings(restaurantId);

  // Resolve product names for drinks (single batched query)
  const productIds = useMemo(
    () => (data?.drinks || []).map((d) => d.product_id).filter(Boolean) as string[],
    [data]
  );
  const { data: productsMap = {} } = useQuery({
    queryKey: ['public-nightlife-products', productIds.sort().join(',')],
    queryFn: async () => {
      if (productIds.length === 0) return {} as Record<string, { name: string; image_url: string | null; price: number }>;
      const { data } = await publicSupabase
        .from('products')
        .select('id, name, image_url, price')
        .in('id', productIds);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => (map[p.id] = p));
      return map;
    },
    enabled: productIds.length > 0,
  });

  const now = Date.now();
  const acts = data?.acts || [];
  const drinks = data?.drinks || [];

  const playing = acts.find((a) => new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() >= now);
  const upcoming = acts.filter((a) => new Date(a.starts_at).getTime() > now).slice(0, 5);
  const liveDrink = drinks.find((d) => new Date(d.starts_at).getTime() <= now && new Date(d.ends_at).getTime() >= now);
  const nextDrink = !liveDrink
    ? drinks.find((d) => new Date(d.starts_at).getTime() > now)
    : null;

  // SEO
  useEffect(() => {
    if (restaurant?.name) {
      document.title = `${restaurant.name} — Programação da Noite`;
      const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
      meta.setAttribute('name', 'description');
      meta.setAttribute('content', `Veja o line-up ao vivo e drinks promocionais da noite no ${restaurant.name}.`);
      if (!meta.parentElement) document.head.appendChild(meta);
    }
  }, [restaurant]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0420] via-[#160a35] to-[#0a0420] text-white relative overflow-hidden">
      {/* animated bg blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-fuchsia-500 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-cyan-500 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-primary blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        {/* header */}
        <header className="flex items-center justify-between mb-6">
          <Link to={backHref} className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </Link>
          {restaurant && (
            <div className="flex items-center gap-2">
              {restaurant.logo_url && (
                <img src={restaurant.logo_url} alt={restaurant.name} className="h-8 w-8 rounded-full object-cover ring-2 ring-white/20" />
              )}
              <span className="text-sm font-medium truncate max-w-[180px]">{restaurant.name}</span>
            </div>
          )}
        </header>

        {/* live pill */}
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> AO VIVO
          </span>
        </div>

        <h1 className="font-heading text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-1">
          A Noite{' '}
          <span className="bg-gradient-to-r from-fuchsia-400 via-pink-500 to-cyan-400 bg-clip-text text-transparent">
            Tá Rolando
          </span>
        </h1>
        <p className="text-center text-white/60 text-sm mb-8">
          Line-up ao vivo + promoções por hora
        </p>

        {isLoading ? (
          <p className="text-center text-white/50 py-12">Carregando...</p>
        ) : (
          <>
            {/* AGORA TOCANDO */}
            <section className="mb-8">
              <div className="rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">Tocando agora</span>
                </div>
                {playing ? (
                  <div className="flex items-center gap-5 flex-wrap">
                    {playing.image_url ? (
                      <img
                        src={playing.image_url}
                        alt={playing.artist_name}
                        className="h-24 w-24 md:h-32 md:w-32 rounded-2xl object-cover ring-4 ring-fuchsia-500/40 shadow-2xl"
                      />
                    ) : (
                      <div className="h-24 w-24 md:h-32 md:w-32 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center shadow-2xl">
                        <Music className="h-12 w-12 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-heading text-3xl md:text-5xl font-black leading-tight truncate">
                        {playing.artist_name}
                      </h2>
                      {playing.genre && (
                        <p className="text-fuchsia-300 text-sm md:text-base font-medium mt-1">{playing.genre}</p>
                      )}
                      {playing.description && (
                        <p className="text-white/60 text-xs md:text-sm mt-2 line-clamp-2">{playing.description}</p>
                      )}
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/40 border border-white/10 px-3 py-1.5">
                        <Clock className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-xs font-mono">
                          Termina em <strong className="text-cyan-300">{formatRemaining(new Date(playing.ends_at).getTime() - now)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Music className="h-12 w-12 text-white/30 mx-auto mb-2" />
                    <p className="text-white/60">Nenhuma atração no ar agora.</p>
                    {upcoming[0] && (
                      <p className="text-xs text-white/40 mt-1">
                        Próxima:{' '}
                        <strong className="text-white/70">{upcoming[0].artist_name}</strong> em{' '}
                        {formatRemaining(new Date(upcoming[0].starts_at).getTime() - now)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* DRINK DA HORA */}
            <section className="mb-8">
              <div className="rounded-3xl bg-gradient-to-br from-primary/30 via-pink-500/20 to-fuchsia-500/30 backdrop-blur-xl border border-primary/30 p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <Sparkles className="absolute -top-2 -right-2 h-32 w-32 text-white/5" />
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-yellow-200">Drink da Hora</span>
                </div>
                {liveDrink ? (
                  <div className="flex items-center gap-5 flex-wrap">
                    {(liveDrink.custom_image_url || (liveDrink.product_id && productsMap[liveDrink.product_id]?.image_url)) ? (
                      <img
                        src={liveDrink.custom_image_url || productsMap[liveDrink.product_id!]?.image_url}
                        alt="drink"
                        className="h-24 w-24 md:h-32 md:w-32 rounded-2xl object-cover ring-4 ring-yellow-400/40 shadow-2xl"
                      />
                    ) : (
                      <div className="h-24 w-24 md:h-32 md:w-32 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl">
                        <Beer className="h-12 w-12 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-2xl md:text-4xl font-black leading-tight">
                        {liveDrink.custom_name || productsMap[liveDrink.product_id!]?.name || 'Promoção especial'}
                      </h3>
                      <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                        <span className="font-heading text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                          {fmt(liveDrink.promo_price)}
                        </span>
                        {liveDrink.product_id && productsMap[liveDrink.product_id]?.price > liveDrink.promo_price && (
                          <span className="text-white/50 line-through text-base">
                            {fmt(productsMap[liveDrink.product_id].price)}
                          </span>
                        )}
                      </div>
                      {liveDrink.highlight_text && (
                        <span className="inline-block mt-2 text-xs font-black bg-yellow-400 text-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {liveDrink.highlight_text}
                        </span>
                      )}
                      <p className="mt-3 text-xs font-mono text-white/70">
                        Acaba em <strong className="text-yellow-300">{formatRemaining(new Date(liveDrink.ends_at).getTime() - now)}</strong>
                      </p>
                    </div>
                  </div>
                ) : nextDrink ? (
                  <div className="text-center py-4">
                    <p className="text-white/70 text-sm">Próxima promo em <strong className="text-yellow-300 font-mono">{formatRemaining(new Date(nextDrink.starts_at).getTime() - now)}</strong></p>
                    <p className="text-white/90 mt-1 font-bold">
                      {nextDrink.custom_name || productsMap[nextDrink.product_id!]?.name} por {fmt(nextDrink.promo_price)}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-white/60 py-4">Nenhuma promo ativa no momento.</p>
                )}
              </div>
            </section>

            {/* PEDIDO DE MÚSICA */}
            {restaurantId && (
              <PublicMusicRequest restaurantId={restaurantId} settings={settings as any} />
            )}

            {/* PRÓXIMOS SETS */}
            {upcoming.length > 0 && (
              <section className="mb-8">
                <h3 className="font-heading text-lg font-bold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Próximos sets
                </h3>
                <div className="space-y-2">
                  {upcoming.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-3"
                    >
                      {a.image_url ? (
                        <img src={a.image_url} alt={a.artist_name} className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-cyan-600 flex items-center justify-center">
                          <Music className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{a.artist_name}</p>
                        {a.genre && <p className="text-xs text-white/50">{a.genre}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-cyan-300 font-mono">
                          em {formatRemaining(new Date(a.starts_at).getTime() - now)}
                        </p>
                        <p className="text-[10px] text-white/40">
                          {new Date(a.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {acts.length === 0 && drinks.length === 0 && (
              <div className="text-center py-12 text-white/50">
                <p>Sem programação cadastrada para esta noite.</p>
              </div>
            )}
          </>
        )}

        <footer className="text-center mt-12 pb-6 text-[10px] text-white/30">
          Powered by <Link to="/" className="hover:text-white/60 underline">Bora Uai</Link>
        </footer>
      </div>
    </div>
  );
}
