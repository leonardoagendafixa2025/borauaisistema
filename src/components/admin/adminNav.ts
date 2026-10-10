import {
  LayoutDashboard, ClipboardList, UtensilsCrossed, QrCode, Smartphone, BellRing, Truck, Scale, Activity,
  Layers, Package, ImageIcon, Tag,
  Disc3, Music, Zap,
  CreditCard, Receipt, BarChart3, Sparkles,
  Users, Star, CalendarCheck, Gift,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlanFeatures } from '@/hooks/usePlanFeatures';

export type AdminNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  requiredFeature?: keyof PlanFeatures;
  /** Used by Cmd+K to surface keywords */
  keywords?: string[];
};

export type AdminNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'home',
    label: 'Visão geral',
    icon: LayoutDashboard,
    items: [
      { label: 'Dashboard', path: '/restaurant', icon: LayoutDashboard, keywords: ['home', 'inicio', 'kpi'] },
      { label: 'Insights IA', path: '/restaurant/ai-insights', icon: Sparkles, requiredFeature: 'hasAiInsights', keywords: ['ia', 'ai', 'sugestoes'] },
    ],
  },
  {
    id: 'operacao',
    label: 'Operação',
    icon: ClipboardList,
    items: [
      { label: 'Central Op.', path: '/restaurant/ops', icon: Activity, keywords: ['hub', 'central', 'ao vivo', 'live'] },
      { label: 'Caixa', path: '/restaurant/cashier', icon: CreditCard, requiredFeature: 'hasMultiCashier', keywords: ['pos', 'venda', 'pdv'] },
      { label: 'Pedidos', path: '/restaurant/orders', icon: ClipboardList, keywords: ['orders', 'pedido'] },
      { label: 'Cozinha (KDS)', path: '/restaurant/kitchen', icon: UtensilsCrossed, requiredFeature: 'hasKds', keywords: ['kds', 'cozinha', 'preparo'] },
      { label: 'Mesas', path: '/restaurant/tables', icon: QrCode, requiredFeature: 'hasQrCode', keywords: ['mesa', 'comanda'] },
      { label: 'Garçom (PWA)', path: '/garcom', icon: Smartphone, requiredFeature: 'hasQrCode', keywords: ['garcom', 'waiter'] },
      { label: 'Chamadas', path: '/restaurant/waiter-calls', icon: BellRing, requiredFeature: 'hasQrCode', keywords: ['call', 'chamada'] },
      { label: 'Entregadores', path: '/restaurant/deliveries', icon: Truck, keywords: ['driver', 'motoboy'] },
      { label: 'Balança', path: '/restaurant/scale', icon: Scale, keywords: ['peso', 'kg'] },
    ],
  },
  {
    id: 'cardapio',
    label: 'Cardápio & Estoque',
    icon: Layers,
    items: [
      { label: 'Cardápio', path: '/restaurant/menu', icon: Layers, keywords: ['menu', 'produto', 'categoria'] },
      { label: 'Estoque', path: '/restaurant/inventory', icon: Package, requiredFeature: 'hasInventory', keywords: ['inventory', 'estoque'] },
      { label: 'Banners Promo', path: '/restaurant/banners', icon: ImageIcon, requiredFeature: 'hasVisualCustomization', keywords: ['banner', 'destaque'] },
      { label: 'Cupons', path: '/restaurant/coupons', icon: Tag, keywords: ['cupom', 'desconto', 'coupon'] },
    ],
  },
  {
    id: 'balada',
    label: 'Modo Balada',
    icon: Disc3,
    items: [
      { label: 'Hub Balada', path: '/restaurant/balada-hub', icon: Disc3, requiredFeature: 'hasQuickSale', keywords: ['balada hub', 'noite resumo'] },
      { label: 'Modo Balada', path: '/restaurant/balada', icon: Zap, requiredFeature: 'hasQuickSale', keywords: ['balada', 'noite'] },
      { label: 'Programação', path: '/restaurant/programacao', icon: Music, requiredFeature: 'hasQuickSale', keywords: ['lineup', 'dj', 'show'] },
      { label: 'Painel DJ', path: '/restaurant/dj', icon: Disc3, requiredFeature: 'hasQuickSale', keywords: ['dj', 'fila', 'musica'] },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: Receipt,
    items: [
      { label: 'Hub Financeiro', path: '/restaurant/finance', icon: BarChart3, keywords: ['financeiro', 'kpi', 'resumo'] },
      { label: 'Despesas', path: '/restaurant/expenses', icon: Receipt, keywords: ['expense', 'conta', 'pagar'] },
      { label: 'Relatórios', path: '/restaurant/reports', icon: BarChart3, requiredFeature: 'hasAdvancedReports', keywords: ['report', 'dre'] },
      { label: 'Assinatura', path: '/restaurant/billing', icon: CreditCard, keywords: ['plano', 'stripe', 'pagamento'] },
    ],
  },
  {
    id: 'crm',
    label: 'CRM & Marketing',
    icon: Users,
    items: [
      { label: 'Clientes', path: '/restaurant/customers', icon: Users, requiredFeature: 'hasCrm', keywords: ['cliente', 'crm'] },
      { label: 'Avaliações (NPS)', path: '/restaurant/feedback', icon: Star, keywords: ['nps', 'avaliacao'] },
      { label: 'Reservas', path: '/restaurant/reservations', icon: CalendarCheck, requiredFeature: 'hasReservations', keywords: ['reserva', 'booking'] },
      { label: 'Indique e ganhe', path: '/restaurant/indique', icon: Gift, keywords: ['indicacao', 'afiliado', 'comissao', 'referral'] },
    ],
  },
  {
    id: 'config',
    label: 'Configurações',
    icon: Settings,
    items: [
      { label: 'Equipe', path: '/restaurant/team', icon: Users, keywords: ['equipe', 'team', 'garcom', 'staff', 'usuario', 'colaborador'] },
      { label: 'Configurações', path: '/restaurant/settings', icon: Settings, keywords: ['settings', 'config'] },
    ],
  },
];

/** Flat list with group context — used by Cmd+K and breadcrumbs */
export const ADMIN_NAV_FLAT = ADMIN_NAV.flatMap((g) =>
  g.items.map((it) => ({ ...it, groupLabel: g.label, groupId: g.id })),
);

export function findNavByPath(pathname: string) {
  // exact > prefix
  return (
    ADMIN_NAV_FLAT.find((it) => it.path === pathname) ||
    ADMIN_NAV_FLAT.find((it) => it.path !== '/restaurant' && pathname.startsWith(it.path))
  );
}
