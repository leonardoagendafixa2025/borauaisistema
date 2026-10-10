import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp, ShoppingBag, DollarSign, Trophy, Receipt } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Period = 'today' | 'week' | 'month';

function periodStart(p: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === 'week') d.setDate(d.getDate() - 6);
  if (p === 'month') d.setDate(d.getDate() - 29);
  return d;
}

export default function GarcomMySales() {
  const navigate = useNavigate();
  const { user, restaurantId, loading } = useAuth();
  const [period, setPeriod] = useState<Period>('today');

  useEffect(() => {
    if (!loading && !user) navigate('/restaurant/login');
  }, [loading, user, navigate]);

  const since = useMemo(() => periodStart(period).toISOString(), [period]);

  // Minhas vendas
  const { data: myOrders = [], isLoading } = useQuery({
    queryKey: ['my-sales', user?.id, restaurantId, period],
    queryFn: async () => {
      if (!user?.id || !restaurantId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, number, total, status, created_at, customer_name, table_id, type, payment_method')
        .eq('restaurant_id', restaurantId)
        .eq('served_by', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!restaurantId,
    refetchInterval: 30_000,
  });

  // Ranking de garçons (hoje sempre)
  const { data: ranking = [] } = useQuery({
    queryKey: ['waiter-ranking', restaurantId, period],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from('orders')
        .select('served_by, total, status')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .not('served_by', 'is', null);
      const map = new Map<string, { total: number; count: number }>();
      for (const o of (data || []) as any[]) {
        if (o.status === 'cancelled') continue;
        const cur = map.get(o.served_by) || { total: 0, count: 0 };
        cur.total += Number(o.total || 0);
        cur.count += 1;
        map.set(o.served_by, cur);
      }
      const arr = Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
      arr.sort((a, b) => b.total - a.total);
      return arr;
    },
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  });

  // Buscar nomes dos garçons do ranking
  const { data: profiles = [] } = useQuery({
    queryKey: ['ranking-profiles', ranking.map((r) => r.id).join(',')],
    queryFn: async () => {
      if (ranking.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ranking.map((r) => r.id));
      return data || [];
    },
    enabled: ranking.length > 0,
  });

  const validOrders = myOrders.filter((o: any) => o.status !== 'cancelled');
  const totalRevenue = validOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const avgTicket = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

  const myRank = ranking.findIndex((r) => r.id === user?.id);
  const myName = (user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'Você';

  const nameOf = (id: string) => {
    if (id === user?.id) return myName;
    const p = profiles.find((p: any) => p.user_id === id);
    return p?.full_name || 'Garçom';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Link to="/garcom" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase text-muted-foreground leading-none">👤 {myName}</p>
            <h1 className="font-bold text-sm truncate">Minhas Vendas</h1>
          </div>
        </div>
        <div className="flex gap-1 px-3 pb-2">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {p === 'today' ? 'Hoje' : p === 'week' ? '7 dias' : '30 dias'}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="card-elevated p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase font-bold">
              <DollarSign className="h-3 w-3" /> Total
            </div>
            <p className="text-xl font-bold mt-1">{fmt(totalRevenue)}</p>
          </div>
          <div className="card-elevated p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase font-bold">
              <ShoppingBag className="h-3 w-3" /> Pedidos
            </div>
            <p className="text-xl font-bold mt-1">{validOrders.length}</p>
          </div>
          <div className="card-elevated p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase font-bold">
              <TrendingUp className="h-3 w-3" /> Ticket médio
            </div>
            <p className="text-xl font-bold mt-1">{fmt(avgTicket)}</p>
          </div>
          <div className="card-elevated p-3 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-1.5 text-primary text-[10px] uppercase font-bold">
              <Trophy className="h-3 w-3" /> Sua posição
            </div>
            <p className="text-xl font-bold mt-1">
              {myRank >= 0 ? `${myRank + 1}º` : '—'}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">
                de {ranking.length}
              </span>
            </p>
          </div>
        </div>

        {/* Ranking */}
        {ranking.length > 1 && (
          <div className="card-elevated p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm">🏆 Corrida da venda</h2>
            </div>
            <div className="space-y-1.5">
              {ranking.slice(0, 10).map((r, i) => {
                const isMe = r.id === user?.id;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-lg ${
                      isMe ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm font-bold w-6 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                        {i + 1}º
                      </span>
                      <span className={`text-sm truncate ${isMe ? 'font-bold' : ''}`}>
                        {nameOf(r.id)} {isMe && '(você)'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fmt(r.total)}</p>
                      <p className="text-[10px] text-muted-foreground">{r.count} pedidos</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista de pedidos */}
        <div className="card-elevated p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-sm">Meus pedidos</h2>
          </div>
          {isLoading ? (
            <p className="text-center text-muted-foreground text-sm py-6">Carregando...</p>
          ) : myOrders.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">Nenhum pedido neste período</p>
          ) : (
            <div className="space-y-1.5">
              {myOrders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      #{o.number} · {o.customer_name || 'Cliente'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {o.payment_method && ` · ${o.payment_method}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${o.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                      {fmt(Number(o.total || 0))}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
