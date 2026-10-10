import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Truck, MapPin, LogOut, Phone, CheckCircle2, Navigation, AlertTriangle, Power, History, DollarSign, Package } from 'lucide-react';

interface DriverSession {
  driver_id: string;
  driver_name: string;
  restaurant_id: string;
  restaurant_name: string;
  vehicle: string;
  pin: string;
}

interface AssignedOrder {
  id: string;
  number: number;
  customer_name: string;
  customer_phone: string | null;
  address: string | null;
  total: number;
  status: string;
  dispatched_at: string | null;
  payment_method: string | null;
  driver_accepted_at: string | null;
}

interface HistoryOrder {
  id: string;
  number: number;
  customer_name: string;
  address: string | null;
  total: number;
  delivery_fee: number;
  payment_method: string | null;
  status: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

interface EarningsSummary {
  total_deliveries: number;
  total_earnings: number;
  today_deliveries: number;
  today_earnings: number;
  week_deliveries: number;
  week_earnings: number;
  month_deliveries: number;
  month_earnings: number;
}

const HEARTBEAT_MS = 60000;
const ORDERS_POLL_MS = 10000;

type Tab = 'orders' | 'history' | 'earnings';

export default function DriverApp() {
  const navigate = useNavigate();
  const [session, setSession] = useState<DriverSession | null>(null);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [tab, setTab] = useState<Tab>('orders');
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [online, setOnline] = useState<boolean>(() => localStorage.getItem('driver_online') === '1');
  const [lastPosition, setLastPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const alertedOrderIdsRef = useRef<Set<string>>(new Set()); // Pedidos já alertados (persiste em localStorage)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef<boolean>(false);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Restaura sessão do entregador do localStorage (se F5 / reabrir o app)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('driver_session');
      if (stored) {
        setSession(JSON.parse(stored));
      } else {
        navigate('/entregador', { replace: true });
      }
    } catch {
      navigate('/entregador', { replace: true });
    }
  }, [navigate]);

  // Carrega IDs já alertados do localStorage (não tocar 2x para o mesmo pedido)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('driver_alerted_orders');
      if (stored) alertedOrderIdsRef.current = new Set(JSON.parse(stored));
    } catch {}
  }, []);

  const persistAlerted = () => {
    try {
      // Mantém só os últimos 100 IDs para não estourar
      const arr = Array.from(alertedOrderIdsRef.current).slice(-100);
      alertedOrderIdsRef.current = new Set(arr);
      localStorage.setItem('driver_alerted_orders', JSON.stringify(arr));
    } catch {}
  };

  // Pede permissão de notificação ao montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Destrava o áudio na primeira interação do usuário (autoplay policy)
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioCtxRef.current) {
          const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
          if (Ctx) audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().then(() => {
            audioUnlockedRef.current = true;
            setAudioBlocked(false);
          }).catch(() => {});
        } else if (ctx) {
          audioUnlockedRef.current = true;
          setAudioBlocked(false);
        }
      } catch {}
    };
    // Marca como bloqueado se ainda não liberou
    const checkBlocked = () => {
      if (!audioUnlockedRef.current) setAudioBlocked(true);
    };
    const t = setTimeout(checkBlocked, 1500);
    window.addEventListener('click', unlock, { once: false });
    window.addEventListener('touchstart', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    return () => {
      clearTimeout(t);
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Toca beep usando WebAudio (não precisa de arquivo)
  const playBeep = async () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }
      if (ctx.state !== 'running') {
        // Áudio bloqueado pelo navegador (sem interação ainda)
        setAudioBlocked(true);
        return;
      }
      audioUnlockedRef.current = true;
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + start + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      // Toca 2 ciclos para chamar bem a atenção
      playTone(880, 0, 0.25);
      playTone(1175, 0.28, 0.25);
      playTone(880, 0.56, 0.3);
      playTone(1175, 0.95, 0.3);
      playTone(880, 1.30, 0.35);
    } catch (e) { console.warn('beep falhou', e); }
  };

  const triggerNewOrderAlert = (order: AssignedOrder) => {
    // Som
    playBeep();
    // Vibração
    try { navigator.vibrate?.([300, 150, 300, 150, 500]); } catch {}
    // Toast
    toast.success(`🛵 Novo pedido #${order.number} - ${order.customer_name}`, { duration: 8000 });
    // Flash visual
    setNewOrderFlash(true);
    setTimeout(() => setNewOrderFlash(false), 4000);
    // Notificação local (funciona em segundo plano se a aba estiver aberta)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification('Novo pedido para entrega! 🛵', {
          body: `Pedido #${order.number} - ${order.customer_name}\n${order.address || ''}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `order-${order.id}`,
          requireInteraction: true,
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (e) { console.warn('notification falhou', e); }
    }
  };

  // Load assigned orders + poll
  const loadOrders = async (s: DriverSession) => {
    const { data, error } = await supabase.rpc('driver_list_assigned_orders', {
      _driver_id: s.driver_id, _pin: s.pin,
    });
    if (error) { console.error(error); return; }
    const list = (data as any[]) || [];

    // Alerta para QUALQUER pedido ativo que ainda não foi alertado neste device.
    // Assim, mesmo se o app abriu DEPOIS do despacho, o entregador é avisado.
    const newOnes = list.filter((o: AssignedOrder) => !alertedOrderIdsRef.current.has(o.id));
    if (newOnes.length > 0) {
      newOnes.forEach((o: AssignedOrder) => {
        alertedOrderIdsRef.current.add(o.id);
        triggerNewOrderAlert(o);
      });
      persistAlerted();
    }
    knownOrderIdsRef.current = new Set(list.map((o: AssignedOrder) => o.id));

    setOrders(list);
  };

  const loadHistoryAndEarnings = async (s: DriverSession) => {
    setLoadingExtras(true);
    try {
      const [hist, earn] = await Promise.all([
        supabase.rpc('driver_list_history', { _driver_id: s.driver_id, _pin: s.pin, _limit: 100 }),
        supabase.rpc('driver_earnings_summary', { _driver_id: s.driver_id, _pin: s.pin }),
      ]);
      if (!hist.error) setHistory((hist.data as any[]) || []);
      if (!earn.error) {
        const row = Array.isArray(earn.data) ? (earn.data as any)[0] : earn.data;
        setEarnings(row || null);
      }
    } finally {
      setLoadingExtras(false);
    }
  };

  // Carrega histórico/ganhos imediatamente ao logar e sempre que trocar de aba
  useEffect(() => {
    if (!session) return;
    loadHistoryAndEarnings(session);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (tab === 'history' || tab === 'earnings') {
      loadHistoryAndEarnings(session);
    }
  }, [tab, session]);

  useEffect(() => {
    if (!session) return;
    loadOrders(session);
    const i = window.setInterval(() => loadOrders(session), ORDERS_POLL_MS);

    // Realtime: dois canais para máxima cobertura.
    // 1) UPDATE/INSERT já com driver_id = nosso (pedido despachado direto para mim)
    const ch1 = supabase
      .channel(`driver-orders-mine-${session.driver_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${session.driver_id}` },
        () => loadOrders(session)
      )
      .subscribe();

    // 2) Qualquer mudança em orders do meu restaurante (cobre o caso UPDATE de driver_id NULL → meu)
    const ch2 = supabase
      .channel(`driver-orders-rest-${session.restaurant_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${session.restaurant_id}` },
        () => loadOrders(session)
      )
      .subscribe();

    // Recarrega quando a aba volta ao foco (usuário acabou de abrir o app)
    const onFocus = () => loadOrders(session);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(i);
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [session]);

  // Heartbeat sender (sends GPS + status to server)
  const sendHeartbeat = async (lat: number, lng: number, status?: string) => {
    if (!session) return;
    await supabase.rpc('driver_heartbeat', {
      _driver_id: session.driver_id, _pin: session.pin,
      _lat: lat, _lng: lng, _status: status ?? null,
    });
  };

  // Toggle online/GPS tracking
  const startGpsWatch = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Seu dispositivo não suporta GPS');
      return false;
    }
    setGpsError(null);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLastPosition({ lat: latitude, lng: longitude });
      },
      (err) => {
        setGpsError(err.message);
        toast.error('GPS bloqueado: ' + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 20000, timeout: 20000 }
    );
    return true;
  };

  const goOnline = () => {
    if (!startGpsWatch()) return;
    setOnline(true);
    localStorage.setItem('driver_online', '1');
    toast.success('Você está online. Seu GPS está sendo compartilhado.');
    if (session) loadOrders(session);
  };

  const goOffline = async () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    watchIdRef.current = null;
    heartbeatRef.current = null;
    setOnline(false);
    localStorage.setItem('driver_online', '0');
    if (session && lastPosition) {
      await supabase.rpc('driver_heartbeat', {
        _driver_id: session.driver_id, _pin: session.pin,
        _lat: lastPosition.lat, _lng: lastPosition.lng, _status: 'offline',
      });
    }
    toast('Você está offline');
  };

  // Auto-retomar online quando o app reabre (persistência: só fica offline se ele clicou em Pausar)
  useEffect(() => {
    if (!session) return;
    if (online && watchIdRef.current === null) {
      startGpsWatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Heartbeat loop
  useEffect(() => {
    if (!online || !session) return;
    heartbeatRef.current = window.setInterval(() => {
      if (lastPosition) {
        const status = orders.some(o => o.status === 'delivering') ? 'busy' : 'available';
        sendHeartbeat(lastPosition.lat, lastPosition.lng, status);
      }
    }, HEARTBEAT_MS);
    // Imediatamente
    if (lastPosition) {
      const status = orders.some(o => o.status === 'delivering') ? 'busy' : 'available';
      sendHeartbeat(lastPosition.lat, lastPosition.lng, status);
    }
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [online, lastPosition, session, orders]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  const markDelivered = async (orderId: string) => {
    if (!session) return;
    if (!confirm('Confirmar entrega deste pedido?')) return;
    const { data, error } = await supabase.rpc('driver_mark_delivered', {
      _driver_id: session.driver_id, _pin: session.pin, _order_id: orderId,
    });
    if (error || !data) { toast.error('Erro ao concluir entrega'); return; }
    toast.success('Entrega concluída! 🎉');
    loadOrders(session);
    loadHistoryAndEarnings(session);
  };

  const confirmReceipt = async (orderId: string) => {
    if (!session) return;
    const { data, error } = await supabase.rpc('driver_confirm_receipt', {
      _driver_id: session.driver_id, _pin: session.pin, _order_id: orderId,
    });
    if (error) { toast.error('Erro ao confirmar recebimento'); return; }
    const row = Array.isArray(data) ? (data as any)[0] : (data as any);
    if (!row?.success) { toast.error('Não foi possível confirmar este pedido.'); return; }
    if (row.already) {
      toast.info('Este pedido já havia sido confirmado.');
    } else {
      toast.success('Recebimento confirmado! ✅');
    }
    loadOrders(session);
  };

  const openMap = (address: string) => {
    const q = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  const callCustomer = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    window.open(`tel:${clean}`, '_self');
  };

  const whatsapp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    const withCountry = clean.startsWith('55') ? clean : '55' + clean;
    window.open(`https://wa.me/${withCountry}`, '_blank');
  };

  const logout = async () => {
    if (online) await goOffline();
    localStorage.removeItem('driver_session');
    localStorage.removeItem('driver_online');
    navigate('/entregador', { replace: true });
  };

  const elapsed = (iso: string | null) => {
    if (!iso) return '—';
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${mins % 60}min`;
  };

  if (!session) return null;

  const activeCount = orders.filter(o => o.status === 'delivering').length;

  return (
    <div className={`min-h-screen bg-background pb-20 transition-colors duration-300 ${newOrderFlash ? 'animate-pulse ring-4 ring-primary ring-inset' : ''}`}>
      {newOrderFlash && (
        <div className="fixed inset-x-0 top-0 z-50 bg-primary text-primary-foreground py-3 px-4 text-center font-bold shadow-lg animate-in slide-in-from-top">
          🛵 NOVO PEDIDO RECEBIDO!
        </div>
      )}
      {audioBlocked && (
        <button
          onClick={async () => {
            // Força criação + resume do contexto e toca um beep curto de teste
            try {
              if (!audioCtxRef.current) {
                const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
                if (Ctx) audioCtxRef.current = new Ctx();
              }
              await audioCtxRef.current?.resume();
              audioUnlockedRef.current = true;
              setAudioBlocked(false);
              if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().catch(() => {});
              }
              await playBeep();
              toast.success('Notificações sonoras ativadas!');
            } catch {}
          }}
          className="w-full bg-warning text-warning-foreground py-2.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b border-warning/40"
        >
          🔔 Toque aqui para ativar o som dos novos pedidos
        </button>
      )}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Truck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{session.driver_name}</p>
            <p className="text-xs text-muted-foreground truncate">{session.restaurant_name}</p>
          </div>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Online toggle */}
      <div className="px-4 py-4">
        <div className={`rounded-2xl p-4 border-2 transition-all ${online ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'}`} />
                {online ? 'Você está online' : 'Você está offline'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {online
                  ? lastPosition
                    ? `GPS ativo · ${lastPosition.lat.toFixed(4)}, ${lastPosition.lng.toFixed(4)}`
                    : 'Aguardando sinal de GPS...'
                  : 'Ative para receber entregas'}
              </p>
            </div>
            <Button
              onClick={online ? goOffline : goOnline}
              variant={online ? 'outline' : 'default'}
              size="sm"
            >
              <Power className="h-4 w-4 mr-1" />
              {online ? 'Pausar' : 'Iniciar'}
            </Button>
          </div>
          {gpsError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {gpsError}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-3">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
          <button
            onClick={() => setTab('orders')}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${tab === 'orders' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            <Package className="h-4 w-4" /> Entregas
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${tab === 'history' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            <History className="h-4 w-4" /> Histórico
          </button>
          <button
            onClick={() => setTab('earnings')}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${tab === 'earnings' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            <DollarSign className="h-4 w-4" /> Ganhos
          </button>
        </div>
      </div>

      {tab === 'orders' && (
      <>
      {/* Stats */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Em rota</p>
          <p className="text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total atribuídas</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
      </div>

      {/* Orders */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Suas entregas</h2>
          <Button variant="ghost" size="sm" onClick={() => session && loadOrders(session)} className="h-7 text-xs">
            🔄 Atualizar
          </Button>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum pedido atribuído no momento.
          </div>
        ) : orders.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border">
              <div>
                <p className="font-bold text-sm">Pedido #{o.number}</p>
                <p className="text-xs text-muted-foreground">{o.customer_name}</p>
              </div>
              <Badge variant={o.status === 'delivering' ? 'default' : 'secondary'} className="gap-1">
                {o.status === 'delivering' ? '🛵 Em rota' : 'Pronto'}
              </Badge>
            </div>
            <div className="p-3 space-y-2.5">
              {o.address && (
                <button onClick={() => openMap(o.address!)}
                  className="w-full flex items-start gap-2 text-left rounded-lg bg-muted/40 px-3 py-2 hover:bg-muted transition-colors">
                  <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">Endereço</p>
                    <p className="text-sm">{o.address}</p>
                  </div>
                  <Navigation className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">R$ {Number(o.total).toFixed(2)}</span>
              </div>
              {o.payment_method && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Pagamento</span>
                  <span className="font-medium">{o.payment_method}</span>
                </div>
              )}
              {o.dispatched_at && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Saiu há</span>
                  <span className="font-medium">{elapsed(o.dispatched_at)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {o.customer_phone && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => callCustomer(o.customer_phone!)}>
                      <Phone className="h-3.5 w-3.5 mr-1" /> Ligar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => whatsapp(o.customer_phone!)}>
                      WhatsApp
                    </Button>
                  </>
                )}
              </div>
              {o.status === 'delivering' && !o.driver_accepted_at && (
                <Button onClick={() => confirmReceipt(o.id)} variant="secondary" className="w-full" size="sm">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Recebi este pedido
                </Button>
              )}
              {o.driver_accepted_at && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 text-center">
                  ✅ Recebido em {new Date(o.driver_accepted_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {o.status === 'delivering' && o.driver_accepted_at && (
                <Button onClick={() => markDelivered(o.id)} className="w-full" size="sm">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como entregue
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {tab === 'history' && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              Entregas concluídas
              {history.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({history.length} {history.length === 1 ? 'entrega' : 'entregas'})
                </span>
              )}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => session && loadHistoryAndEarnings(session)}
              disabled={loadingExtras}
              className="h-7 text-xs"
            >
              🔄 Atualizar
            </Button>
          </div>
          {loadingExtras && history.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">Carregando…</div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma entrega concluída ainda.
            </div>
          ) : history.map((h) => (
            <div key={h.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-sm">Pedido #{h.number}</p>
                <span className="text-sm font-semibold text-success">
                  + R$ {Number(h.delivery_fee || 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{h.customer_name}</p>
              {h.address && <p className="text-xs text-muted-foreground truncate mt-0.5">📍 {h.address}</p>}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border">
                <span>
                  {h.delivered_at
                    ? new Date(h.delivered_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>Total pedido: R$ {Number(h.total).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'earnings' && (
        <div className="px-4 space-y-3">
          <h2 className="font-semibold text-sm">Seus ganhos</h2>
          <p className="text-xs text-muted-foreground -mt-1">
            Calculado a partir da taxa de entrega de cada pedido concluído.
          </p>

          <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5 shadow-lg">
            <p className="text-xs opacity-80">Ganhos totais</p>
            <p className="text-3xl font-bold mt-1">
              R$ {Number(earnings?.total_earnings || 0).toFixed(2)}
            </p>
            <p className="text-xs opacity-80 mt-1">
              {earnings?.total_deliveries || 0} entregas concluídas
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Hoje</p>
              <p className="text-base font-bold">R$ {Number(earnings?.today_earnings || 0).toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">{earnings?.today_deliveries || 0} entregas</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Semana</p>
              <p className="text-base font-bold">R$ {Number(earnings?.week_earnings || 0).toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">{earnings?.week_deliveries || 0} entregas</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Mês</p>
              <p className="text-base font-bold">R$ {Number(earnings?.month_earnings || 0).toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">{earnings?.month_deliveries || 0} entregas</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => session && loadHistoryAndEarnings(session)}
            disabled={loadingExtras}
          >
            🔄 Atualizar
          </Button>
        </div>
      )}
    </div>
  );
}
