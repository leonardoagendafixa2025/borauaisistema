import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, MessageCircle, CalendarCheck, Star, Utensils, Clock, User } from 'lucide-react';
import { useRestaurantTheme } from '@/hooks/useRestaurantTheme';
import { useRestaurantReservationsEnabled } from '@/hooks/useRestaurantReservationsEnabled';
import { SEO } from '@/components/seo/SEO';
import type { Database } from '@/integrations/supabase/types';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Settings = Database['public']['Tables']['restaurant_settings']['Row'];

interface Props {
  restaurant: Restaurant;
  settings?: Settings | null;
  customerLoggedIn?: boolean;
}

/**
 * Landing page universal do restaurante (`/:slug`).
 * Renderiza quando o restaurante NÃO tem delivery/pickup ativos
 * (ex: só Balada, só QR de mesa, ou só reservas).
 * Funciona como mini-site com botões de ação.
 */
export default function RestaurantLanding({ restaurant, settings, customerLoggedIn }: Props) {
  useRestaurantTheme(settings?.primary_color, settings?.secondary_color);
  const { enabled: reservationsEnabled } = useRestaurantReservationsEnabled(restaurant.id);

  const isClosed = !restaurant.is_open || restaurant.force_closed;
  const slug = restaurant.slug;

  const whatsappLink = restaurant.whatsapp
    ? (() => {
        const phone = restaurant.whatsapp!.replace(/\D/g, '');
        const fullPhone = phone.startsWith('55') ? phone : '55' + phone;
        return `https://wa.me/${fullPhone}`;
      })()
    : null;

  const mapsLink = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.address}, ${restaurant.city || ''}`)}`
    : null;

  const showMenu = settings?.delivery_enabled || settings?.pickup_enabled;

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: restaurant.name,
    url: `https://borauai.com/${slug}`,
    image: restaurant.banner_url || restaurant.logo_url || undefined,
    telephone: restaurant.phone || undefined,
    address: restaurant.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: restaurant.address,
          addressLocality: restaurant.city || undefined,
          addressCountry: 'BR',
        }
      : undefined,
  };

  return (
    <div className="min-h-screen bg-background font-public">
      <SEO
        title={`${restaurant.name} — Reservas, Cardápio e Contato`}
        description={`Reserve sua mesa no ${restaurant.name}${restaurant.city ? ` em ${restaurant.city}` : ''}. Atendimento, avaliações e contato direto via WhatsApp.`}
        path={`/${slug}`}
        image={restaurant.banner_url || restaurant.logo_url || undefined}
        jsonLd={localBusinessJsonLd}
      />
      {/* Banner / hero */}
      <div className="relative h-48 sm:h-64 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent overflow-hidden">
        {restaurant.banner_url ? (
          <img src={restaurant.banner_url} alt={restaurant.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 pt-5 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground transition-colors bg-background/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          {customerLoggedIn ? (
            <Link to="/cliente" className="inline-flex items-center gap-1.5 text-sm bg-background/60 backdrop-blur-sm rounded-full px-3 py-1.5 font-medium">
              <User className="h-4 w-4" />
              Minha Conta
            </Link>
          ) : null}
        </div>
      </div>

      {/* Card principal — sobreposto ao banner */}
      <div className="max-w-2xl mx-auto px-4 -mt-16 relative">
        <div className="bg-card rounded-2xl border border-border/60 shadow-xl p-6 animate-reveal-up">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl bg-background shadow-md flex items-center justify-center shrink-0 overflow-hidden border-2 border-card">
              {restaurant.logo_url
                ? <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-cover" />
                : <span className="font-heading font-bold text-3xl text-primary">{restaurant.name.charAt(0)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-2xl font-bold leading-tight">{restaurant.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className={`inline-flex items-center gap-1 ${!isClosed ? 'text-success' : 'text-destructive'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${!isClosed ? 'bg-success animate-pulse-soft' : 'bg-destructive'}`} />
                  {!isClosed ? 'Aberto agora' : 'Fechado'}
                </span>
              </div>
            </div>
          </div>

          {(restaurant.address || restaurant.phone) && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-2 text-sm">
              {restaurant.address && (
                <a href={mapsLink || '#'} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{restaurant.address}{restaurant.city ? `, ${restaurant.city}` : ''}</span>
                </a>
              )}
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>{restaurant.phone}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Ações principais */}
        <div className="mt-6 grid gap-3">
          {showMenu && (
            <Link to={`/${slug}`} reloadDocument className="flex items-center justify-between rounded-2xl bg-primary text-primary-foreground p-5 shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
                  <Utensils className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="font-heading font-bold text-lg leading-tight">Ver Cardápio</div>
                  <div className="text-xs opacity-90">Peça delivery ou retirada</div>
                </div>
              </div>
              <Clock className="h-5 w-5 opacity-70" />
            </Link>
          )}

          {reservationsEnabled && (
            <Link to={`/${slug}/reservar`} className="flex items-center justify-between rounded-2xl bg-card border border-border p-5 hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-info/10 text-info flex items-center justify-center">
                  <CalendarCheck className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="font-heading font-bold text-lg leading-tight">Reservar Mesa</div>
                  <div className="text-xs text-muted-foreground">Garanta seu lugar</div>
                </div>
              </div>
            </Link>
          )}

          <Link to={`/${slug}/avaliar`} className="flex items-center justify-between rounded-2xl bg-card border border-border p-5 hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition-all">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
                <Star className="h-6 w-6" />
              </div>
              <div className="text-left">
                <div className="font-heading font-bold text-lg leading-tight">Avaliar Atendimento</div>
                <div className="text-xs text-muted-foreground">Conte sua experiência</div>
              </div>
            </div>
          </Link>

          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl bg-card border border-border p-5 hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-success/10 text-success flex items-center justify-center">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="font-heading font-bold text-lg leading-tight">Falar no WhatsApp</div>
                  <div className="text-xs text-muted-foreground">Atendimento direto</div>
                </div>
              </div>
            </a>
          )}
        </div>

        <div className="mt-8 pb-8 text-center text-xs text-muted-foreground">
          Powered by <Link to="/" className="font-semibold text-primary hover:underline">Bora Uai</Link>
        </div>
      </div>
    </div>
  );
}
