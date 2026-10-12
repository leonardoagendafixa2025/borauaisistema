import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ShoppingBag, LogOut, Lock, Download } from 'lucide-react';
import { ADMIN_NAV } from './adminNav';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurant } from '@/hooks/useRestaurantData';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';

const STORAGE_KEY = 'admin_sidebar_groups_v1';

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, restaurantId, availableStores, switchRestaurant } = useAuth();
  const { data: restaurant } = useRestaurant();
  const plan = usePlanFeatures();
  const pwaGarcom = usePWAInstall();

  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(loadGroupState);

  // Auto-open the group containing the active route
  useEffect(() => {
    const next: Record<string, boolean> = { ...groupOpen };
    let changed = false;
    ADMIN_NAV.forEach((g) => {
      const active = g.items.some(
        (it) => pathname === it.path || (it.path !== '/restaurant' && pathname.startsWith(it.path)),
      );
      if (active && !next[g.id]) {
        next[g.id] = true;
        changed = true;
      }
    });
    if (changed) {
      setGroupOpen(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setGroupOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* noop */ }
      return next;
    });
  };

  const handleInstallGarcom = async () => {
    if (pwaGarcom.isStandalone) return toast.info('App já instalado');
    if (pwaGarcom.isIOS) return toast.info('No iPhone/iPad, use o Safari: Compartilhar → Adicionar à Tela', { duration: 6000 });
    const a = document.createElement('a');
    a.href = '/borauai.apk';
    a.download = 'borauai.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Baixando aplicativo Android (.apk)...');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <NavLink to="/restaurant" className="flex items-center gap-2 px-2 py-1">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-heading font-bold text-sm leading-tight truncate">
                {restaurant?.name || 'Meu Restaurante'}
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                Admin
              </span>
            </div>
          )}
        </NavLink>
        {availableStores.length > 1 && !collapsed && (
          <div className="px-2 pb-2 pt-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Trocar Filial
            </label>
            <select
              value={restaurantId || ''}
              onChange={(e) => switchRestaurant(e.target.value)}
              className="w-full text-xs font-semibold rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2 py-1.5 text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-ring cursor-pointer"
            >
              {availableStores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="py-2">
        {ADMIN_NAV.map((g) => {
          const groupActive = g.items.some(
            (it) => pathname === it.path || (it.path !== '/restaurant' && pathname.startsWith(it.path)),
          );
          const isOpen = groupOpen[g.id] ?? groupActive;

          // When collapsed (icon-only): render flat without collapsible chrome
          if (collapsed) {
            return (
              <SidebarGroup key={g.id}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {g.items.map((item) => {
                      const isLocked = item.requiredFeature && !plan.loading && !plan[item.requiredFeature];
                      const isActive =
                        pathname === item.path || (item.path !== '/restaurant' && pathname.startsWith(item.path));
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            asChild={!isLocked}
                            isActive={isActive}
                            tooltip={item.label}
                            disabled={isLocked || undefined}
                          >
                            {isLocked ? (
                              <div className="opacity-40">
                                <item.icon className="h-4 w-4" />
                              </div>
                            ) : (
                              <NavLink to={item.path}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </NavLink>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible key={g.id} open={isOpen} onOpenChange={() => toggleGroup(g.id)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    className={`cursor-pointer flex items-center justify-between hover:text-sidebar-foreground transition-colors ${
                      groupActive ? 'text-sidebar-foreground' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <g.icon className="h-3 w-3 opacity-60" />
                      {g.label}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {g.items.map((item) => {
                        const isLocked = item.requiredFeature && !plan.loading && !plan[item.requiredFeature];
                        const isActive =
                          pathname === item.path || (item.path !== '/restaurant' && pathname.startsWith(item.path));
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              asChild={!isLocked}
                              isActive={isActive}
                              disabled={isLocked || undefined}
                            >
                              {isLocked ? (
                                <div className="opacity-40 cursor-not-allowed flex items-center gap-2">
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  <span className="flex-1">{item.label}</span>
                                  <Lock className="h-3 w-3" />
                                </div>
                              ) : (
                                <NavLink to={item.path}>
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  <span>{item.label}</span>
                                </NavLink>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleInstallGarcom}
              tooltip="Baixar App Garçom (.apk)"
              disabled={pwaGarcom.isStandalone}
            >
              <Download className="h-4 w-4" />
              <span>{pwaGarcom.isStandalone ? 'App instalado' : 'Baixar Garçom (.apk)'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await signOut();
                navigate('/restaurant/login');
              }}
              tooltip="Sair"
              className="text-destructive/80 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
