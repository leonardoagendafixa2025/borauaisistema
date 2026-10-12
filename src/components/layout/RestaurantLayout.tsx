import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, AlertTriangle, Search, ExternalLink } from 'lucide-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminStatusBar from '@/components/admin/AdminStatusBar';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import AdminCommandPalette from '@/components/admin/AdminCommandPalette';
import NotificationCenter from '@/components/NotificationCenter';
import SupportFAB from '@/components/SupportFAB';
import { useTheme } from '@/hooks/useTheme';
import { useRestaurant, useRestaurantSettings } from '@/hooks/useRestaurantData';
import { useRestaurantTheme } from '@/hooks/useRestaurantTheme';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useAuth } from '@/hooks/useAuth';

export default function RestaurantLayout({ children }: { children: ReactNode }) {
  const { theme: themeMode, toggle: toggleDarkMode } = useTheme();
  const darkMode = themeMode === 'dark';

  const { restaurantId, availableStores, switchRestaurant } = useAuth();
  const { data: restaurant } = useRestaurant();
  const { data: settings } = useRestaurantSettings();
  const plan = usePlanFeatures();
  const restaurantSlug = restaurant?.slug;

  useRestaurantTheme(settings?.primary_color, settings?.secondary_color);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />

        <SidebarInset className="flex flex-col flex-1 min-w-0">
          {/* Top bar — sticky, dense, productivity oriented */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/85 backdrop-blur-xl px-3 lg:px-4">
            <SidebarTrigger className="shrink-0" />

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <AdminBreadcrumbs />
              {availableStores.length > 1 && (
                <select
                  value={restaurantId || ''}
                  onChange={(e) => switchRestaurant(e.target.value)}
                  className="hidden sm:inline-flex text-[11px] font-bold rounded-lg border border-border bg-muted/60 px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[140px] truncate"
                  title="Trocar de filial/restaurante"
                >
                  {availableStores.map(s => (
                    <option key={s.id} value={s.id}>
                      🏪 {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Center: live status bar */}
            <div className="flex items-center justify-center min-w-0">
              <AdminStatusBar />
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button
                onClick={() => {
                  // Open command palette via synthesized key
                  const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
                  document.dispatchEvent(ev);
                }}
                className="hidden md:inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ring-1 ring-border bg-muted/40 hover:bg-muted text-muted-foreground transition-colors"
                title="Buscar / ações (Cmd+K)"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Buscar…</span>
                <kbd className="ml-1 hidden lg:inline-flex h-4 items-center rounded border border-border bg-background px-1 text-[9px] font-mono text-muted-foreground">
                  ⌘K
                </kbd>
              </button>

              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title={darkMode ? 'Modo claro' : 'Modo escuro'}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <NotificationCenter />

              {restaurantSlug && (
                <Link
                  to={`/${restaurantSlug}`}
                  target="_blank"
                  className="hidden xl:inline-flex items-center gap-1 ml-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  title="Abrir cardápio público"
                >
                  <ExternalLink className="h-3 w-3" />
                  Cardápio
                </Link>
              )}
            </div>
          </header>

          {/* Main */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">
              {plan.isTrial && plan.trialEndsAt && (() => {
                const daysLeft = Math.max(
                  0,
                  Math.ceil((new Date(plan.trialEndsAt!).getTime() - Date.now()) / 86400000),
                );
                return (
                  <div
                    className={`mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
                      daysLeft <= 3 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {daysLeft === 0
                        ? 'Seu período de teste expira hoje!'
                        : `Seu trial termina em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}. `}
                      Assine agora para continuar usando.
                    </span>
                    <Link
                      to="/restaurant/billing"
                      className="ml-auto shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Assinar agora
                    </Link>
                  </div>
                );
              })()}
              {children}
            </div>
          </main>
        </SidebarInset>

        {/* Global Cmd+K palette */}
        <AdminCommandPalette />
        <SupportFAB />
      </div>
    </SidebarProvider>
  );
}
