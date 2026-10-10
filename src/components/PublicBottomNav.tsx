import { Home, Search, ShoppingBag, User, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  cartCount: number;
  cartTotal?: number;
  onCart: () => void;
  onSearch: () => void;
  onHome: () => void;
  accountHref: string;
  accountLabel?: string;
  active?: 'home' | 'search' | 'cart' | 'account' | 'favorites';
  onFavorites?: () => void;
  hidden?: boolean;
}

/**
 * Bottom navigation — coral-themed, app-style with motion.
 * Active item pops + shows colored indicator dot. Cart is the elevated central FAB.
 */
export default function PublicBottomNav({
  cartCount,
  onCart,
  onSearch,
  onHome,
  accountHref,
  accountLabel = 'Conta',
  active = 'home',
  onFavorites,
  hidden,
}: Props) {
  if (hidden) return null;

  const Item = ({
    id,
    icon: Icon,
    label,
    onClick,
    href,
  }: {
    id: 'home' | 'search' | 'favorites' | 'account';
    icon: typeof Home;
    label: string;
    onClick?: () => void;
    href?: string;
  }) => {
    const isActive = active === id;
    const inner = (
      <>
        <span
          className={`relative inline-flex items-center justify-center h-9 w-9 rounded-2xl transition-all duration-300 ${
            isActive
              ? 'bg-primary/10 text-primary animate-nav-pop'
              : 'text-muted-foreground group-hover:text-foreground'
          }`}
        >
          <Icon
            className="h-[22px] w-[22px] transition-all"
            strokeWidth={isActive ? 2.6 : 2}
            fill={isActive ? 'currentColor' : 'none'}
            fillOpacity={isActive ? 0.15 : 0}
          />
        </span>
        <span
          className={`text-[10px] font-extrabold leading-none tracking-tight mt-0.5 transition-colors ${
            isActive ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {label}
        </span>
        <span
          className={`mt-1 h-[3px] w-6 rounded-full bg-primary transition-all ${
            isActive ? 'opacity-100 scale-x-100 animate-nav-indicator' : 'opacity-0 scale-x-0'
          }`}
        />
      </>
    );

    const cls =
      'tactile group flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 transition-colors';

    if (href) {
      return (
        <Link to={href} className={cls} aria-label={label}>
          {inner}
        </Link>
      );
    }
    return (
      <button onClick={onClick} className={cls} aria-label={label}>
        {inner}
      </button>
    );
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-2xl shadow-[0_-12px_30px_-12px_hsl(var(--primary)/0.18)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegação principal"
    >
      <div className="max-w-md md:max-w-lg mx-auto px-2 sm:px-4 flex items-stretch h-[64px]">
        <Item id="home" icon={Home} label="Início" onClick={onHome} />
        <Item id="search" icon={Search} label="Buscar" onClick={onSearch} />

        {/* Carrinho — FAB central elevado */}
        <button
          onClick={onCart}
          className="tactile group flex flex-col items-center justify-end flex-1 min-w-0 relative -mt-7"
          aria-label={`Carrinho${cartCount > 0 ? `, ${cartCount} itens` : ''}`}
        >
          <span
            className={`relative h-16 w-16 rounded-full flex items-center justify-center ring-[5px] ring-background transition-all duration-300 group-active:scale-95 ${
              cartCount > 0
                ? 'bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-primary-foreground shadow-coral animate-float-soft'
                : 'bg-gradient-to-br from-foreground to-foreground/80 text-background shadow-lg'
            }`}
          >
            <ShoppingBag className="h-[26px] w-[26px]" strokeWidth={2.4} />
            {cartCount > 0 && (
              <span
                key={cartCount}
                className="absolute -top-1 -right-1 h-6 min-w-[1.5rem] px-1 rounded-full bg-accent text-accent-foreground text-[11px] font-black flex items-center justify-center ring-[3px] ring-background animate-cart-bump shadow-md"
              >
                {cartCount}
              </span>
            )}
          </span>
        </button>

        <Item
          id="favorites"
          icon={Heart}
          label="Favoritos"
          onClick={onFavorites ?? onSearch}
        />
        <Item id="account" icon={User} label={accountLabel} href={accountHref} />
      </div>
    </nav>
  );
}
