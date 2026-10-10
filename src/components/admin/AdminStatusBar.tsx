import { Link } from 'react-router-dom';
import { ClipboardList, QrCode, Disc3, CreditCard } from 'lucide-react';
import { useAdminLiveStats } from '@/hooks/useAdminLiveStats';
import { useRestaurant } from '@/hooks/useRestaurantData';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function AdminStatusBar() {
  const { data: restaurant } = useRestaurant();
  const stats = useAdminLiveStats();
  const plan = usePlanFeatures();
  const qc = useQueryClient();
  const isOpen = restaurant?.is_open ?? false;
  const forceClosed = (restaurant as any)?.force_closed ?? false;

  const { data: openCashier } = useQuery({
    queryKey: ['cashier-open', restaurant?.id],
    enabled: !!restaurant?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('cashier_sessions')
        .select('id')
        .eq('restaurant_id', restaurant!.id)
        .is('closed_at', null)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const cashierOpen = !!openCashier;

  useEffect(() => {
    if (!restaurant?.id) return;
    const ch = supabase
      .channel(`cashier-bar-${restaurant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashier_sessions', filter: `restaurant_id=eq.${restaurant.id}` },
        () => qc.invalidateQueries({ queryKey: ['cashier-open', restaurant.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant?.id, qc]);

  const toggleOpen = async () => {
    if (!restaurant) return;
    if (isOpen) {
      await supabase.from('restaurants').update({ force_closed: true, is_open: false } as any).eq('id', restaurant.id);
      toast.success('Restaurante fechado manualmente');
    } else {
      await supabase.from('restaurants').update({ force_closed: false, is_open: true } as any).eq('id', restaurant.id);
      toast.success('Restaurante reaberto');
    }
    qc.invalidateQueries({ queryKey: ['restaurant'] });
  };

  return (
    <div className="flex items-center gap-1.5 lg:gap-2 overflow-x-auto scrollbar-none">
      {/* Master status */}
      <button
        onClick={toggleOpen}
        title={isOpen ? 'Clique para fechar' : 'Clique para reabrir'}
        className={`group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all hover:-translate-y-0.5 shrink-0 ${
          isOpen
            ? 'bg-success/10 text-success ring-success/30 hover:bg-success/15'
            : 'bg-muted text-muted-foreground ring-border hover:bg-muted/70'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
        {forceClosed ? 'Fechado (manual)' : isOpen ? 'Aberto' : 'Fechado'}
      </button>

      {/* Caixa */}
      {plan.hasMultiCashier && (
        <Link
          to="/restaurant/cashier"
          className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-all hover:-translate-y-0.5 shrink-0 ${
            cashierOpen
              ? 'ring-success/30 bg-success/10 text-success hover:bg-success/15'
              : 'ring-warning/40 bg-warning/10 text-warning hover:bg-warning/15 animate-pulse-soft'
          }`}
        >
          <CreditCard className="h-3 w-3" />
          {cashierOpen ? 'Caixa aberto' : 'Caixa fechado'}
        </Link>
      )}

      {/* Live counters */}
      <Link
        to="/restaurant/orders"
        className="hidden md:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-border bg-card hover:bg-muted/50 transition-all shrink-0"
        title="Pedidos abertos"
      >
        <ClipboardList className="h-3 w-3 text-muted-foreground" />
        <span className="text-foreground tabular-nums">{stats.openOrders}</span>
        <span className="text-muted-foreground">pedidos</span>
      </Link>
      <Link
        to="/restaurant/tables"
        className="hidden md:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-border bg-card hover:bg-muted/50 transition-all shrink-0"
        title="Mesas ocupadas"
      >
        <QrCode className="h-3 w-3 text-muted-foreground" />
        <span className="text-foreground tabular-nums">{stats.busyTables}</span>
        <span className="text-muted-foreground">mesas</span>
      </Link>
      {plan.hasQuickSale && stats.djQueue > 0 && (
        <Link
          to="/restaurant/dj"
          className="hidden md:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-500/15 transition-all shrink-0 animate-pulse-soft"
          title="Pedidos de música na fila"
        >
          <Disc3 className="h-3 w-3" />
          <span className="tabular-nums">{stats.djQueue}</span>
          <span className="opacity-80">na fila DJ</span>
        </Link>
      )}
    </div>
  );
}
