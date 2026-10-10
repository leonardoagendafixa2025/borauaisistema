import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, CheckCheck, ExternalLink, Inbox, ShoppingCart, BellRing, Disc3, Package, AlertTriangle, Info } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

type Category = 'all' | 'orders' | 'service' | 'music' | 'inventory' | 'billing' | 'other';

const CATEGORY_BY_TYPE: Record<string, Category> = {
  new_order: 'orders',
  order_completed: 'orders',
  waiter_call: 'service',
  music_request: 'music',
  inventory_low: 'inventory',
  subscription_overdue: 'billing',
  subscription_cancelled: 'billing',
  trial_expiring: 'billing',
};

const TYPE_ICON: Record<string, any> = {
  new_order: ShoppingCart,
  order_completed: ShoppingCart,
  waiter_call: BellRing,
  music_request: Disc3,
  inventory_low: Package,
  subscription_overdue: AlertTriangle,
  trial_expiring: AlertTriangle,
};

const TYPE_TINT: Record<string, string> = {
  new_order: 'text-primary',
  order_completed: 'text-success',
  waiter_call: 'text-warning',
  music_request: 'text-fuchsia-500',
  inventory_low: 'text-orange-500',
  subscription_overdue: 'text-destructive',
  trial_expiring: 'text-destructive',
};

const CATS: { id: Category; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'service', label: 'Mesa/Garçom' },
  { id: 'music', label: 'DJ' },
  { id: 'inventory', label: 'Estoque' },
  { id: 'billing', label: 'Plano' },
];

function fmt(dt: string) {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Category>('all');
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: 0, orders: 0, service: 0, music: 0, inventory: 0, billing: 0, other: 0 };
    notifications.forEach((n) => {
      if (n.read) return;
      const cat = CATEGORY_BY_TYPE[n.type] || 'other';
      c[cat]++;
      c.all++;
    });
    return c;
  }, [notifications]);

  const filtered = useMemo(() => {
    if (cat === 'all') return notifications;
    return notifications.filter((n) => (CATEGORY_BY_TYPE[n.type] || 'other') === cat);
  }, [notifications, cat]);

  const handleClick = (n: any) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse-soft">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[400px] rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-heading font-bold text-sm">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-primary hover:text-primary/80 font-bold inline-flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" /> Marcar tudo
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto scrollbar-none">
            {CATS.map((c) => {
              const n = counts[c.id];
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-foreground text-background'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {c.label}
                  {n > 0 && (
                    <span className={`tabular-nums rounded-full px-1.5 ${active ? 'bg-background/20' : 'bg-primary/15 text-primary'}`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Nenhuma notificação por aqui.
              </div>
            ) : (
              filtered.map((n) => {
                const Icon = TYPE_ICON[n.type] || Info;
                const tint = TYPE_TINT[n.type] || 'text-muted-foreground';
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0 ${
                      !n.read ? 'bg-primary/[0.04]' : ''
                    }`}
                  >
                    <div className={`shrink-0 mt-0.5 h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center ${tint}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!n.read ? 'font-bold' : 'font-medium text-foreground/80'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 tabular-nums">
                          {fmt(n.created_at)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      {n.link && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary mt-1 font-bold">
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </span>
                      )}
                    </div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
