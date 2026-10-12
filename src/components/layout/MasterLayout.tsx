import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, CreditCard, Users, Settings, LogOut,
  ChevronLeft, Menu, TrendingUp, FileText, Plug, ShieldAlert, Activity, Megaphone, AlertTriangle,
  Package, Ticket, Flag, BarChart3, Sparkles, LogIn, MessageSquare, BellRing
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import logoImg from '@/assets/logo.png';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/master' },
  { label: 'Métricas SaaS', icon: BarChart3, path: '/master/metricas' },
  { label: 'Restaurantes', icon: Store, path: '/master/restaurants' },
  { label: 'Onboarding 7d', icon: Sparkles, path: '/master/onboarding' },
  { label: 'Inadimplência', icon: AlertTriangle, path: '/master/inadimplencia' },
  { label: 'Financeiro', icon: CreditCard, path: '/master/financial' },
  { label: 'Assinaturas', icon: TrendingUp, path: '/master/subscriptions' },
  { label: 'Planos', icon: Package, path: '/master/planos' },
  { label: 'Cupons SaaS', icon: Ticket, path: '/master/cupons' },
  { label: 'Feature Flags', icon: Flag, path: '/master/feature-flags' },
  { label: 'Notificações Push', icon: BellRing, path: '/master/push' },
  { label: 'Comunicados', icon: Megaphone, path: '/master/comunicados' },
  { label: 'Templates', icon: MessageSquare, path: '/master/templates' },
  { label: 'Integrações', icon: Plug, path: '/master/integracoes' },
  { label: 'Usuários', icon: Users, path: '/master/users' },
  { label: 'Impersonations', icon: LogIn, path: '/master/impersonations' },
  { label: 'Auditoria', icon: ShieldAlert, path: '/master/auditoria' },
  { label: 'Saúde', icon: Activity, path: '/master/saude' },
  { label: 'Relatórios', icon: FileText, path: '/master/reports' },
  { label: 'Configurações', icon: Settings, path: '/master/settings' },
];

export default function MasterLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'AD';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300
        ${collapsed ? 'w-[72px]' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <Link to="/master" className="flex items-center gap-2">
              <img src={logoImg} alt="Bora Uai" className="h-9 w-auto" />
            </Link>
          )}
          {collapsed && (
            <Link to="/master" className="mx-auto">
              <img src={logoImg} alt="Bora Uai" className="h-8 w-8 object-contain" />
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/master' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150
                  ${isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }
                  ${collapsed ? 'justify-center px-0' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="hidden lg:flex flex-col border-t border-sidebar-border p-3 gap-1">
          <button
            onClick={async () => { await signOut(); navigate('/master/login'); }}
            className="flex items-center justify-center w-full gap-2 rounded-lg px-3 py-2 text-sm text-destructive/70 hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block">
            <h2 className="text-sm font-medium text-muted-foreground">Painel Master</h2>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell />
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center" title={user?.email || ''}>
              <span className="text-xs font-semibold text-primary">{userInitials}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
