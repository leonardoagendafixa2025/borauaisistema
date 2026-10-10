import { useState, useEffect, useRef } from 'react';
import { ChefHat, Clock, CheckCircle, AlertCircle, Volume2, VolumeX, Tv, Monitor, LayoutGrid, Truck, Flame, Utensils, Store, Bike, Snowflake, Bell, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useRestaurantOrders, useRestaurantCategories, useRestaurantProducts } from '@/hooks/useRestaurantData';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

const formatTime = (d: string) => {
  const date = new Date(d);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getElapsed = (d: string) => {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return mins < 1 ? 'agora' : `${mins}min`;
};

export default function KitchenDisplay() {
  useRealtimeOrders();
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allOrders = [] } = useRestaurantOrders(['new', 'accepted', 'preparing', 'ready']);
  const { data: categories = [] } = useRestaurantCategories();
  const { data: products = [] } = useRestaurantProducts();

  // ===== Preferências por usuário + por dispositivo =====
  // Chave: kds_prefs:{userId} no localStorage deste device. Cada conta logada
  // mantém suas próprias prefs neste navegador. Outros dispositivos têm as suas.
  type SoundPrefs = { enabled: boolean; onNew: boolean; onWarn: boolean; onLate: boolean; volume: number };
  type TvPreset = 'status' | 'type' | 'priority';
  type SortMode = 'priority' | 'created';
  type KdsPrefs = {
    tvMode: boolean;
    fullscreen: boolean;
    tvPreset: TvPreset;
    sound: SoundPrefs;
    sortByDelay: boolean;
    sortMode: SortMode;
    lowMotion: boolean;
    batchMs: number; // janela de atualização em lote (ms); 0 = desativado
  };
  const SOUND_DEFAULTS: SoundPrefs = { enabled: true, onNew: true, onWarn: false, onLate: true, volume: 0.6 };
  const PREFS_DEFAULTS: KdsPrefs = { tvMode: false, fullscreen: false, tvPreset: 'status', sound: SOUND_DEFAULTS, sortByDelay: false, sortMode: 'priority', lowMotion: false, batchMs: 0 };
  const prefsKey = `kds_prefs:${user?.id ?? 'anon'}`;

  const loadPrefs = (key: string): KdsPrefs => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...PREFS_DEFAULTS,
          ...parsed,
          sound: { ...SOUND_DEFAULTS, ...(parsed.sound || {}) },
        };
      }
      // Migração one-shot das chaves antigas (globais por device)
      const legacyTv = localStorage.getItem('kds_tv_mode') === '1';
      const legacyPreset = (localStorage.getItem('kds_tv_preset') as TvPreset) || 'status';
      const legacySoundRaw = localStorage.getItem('kds_sound_prefs');
      const legacySound = legacySoundRaw ? { ...SOUND_DEFAULTS, ...JSON.parse(legacySoundRaw) } : SOUND_DEFAULTS;
      const migrated: KdsPrefs = { tvMode: legacyTv, fullscreen: false, tvPreset: legacyPreset, sound: legacySound, sortByDelay: false, sortMode: 'priority', lowMotion: false, batchMs: 0 };
      localStorage.setItem(key, JSON.stringify(migrated));
      return migrated;
    } catch { return PREFS_DEFAULTS; }
  };

  const [prefs, setPrefsState] = useState<KdsPrefs>(() => loadPrefs(prefsKey));

  // Re-carrega quando o usuário muda (logout/login na mesma sessão)
  useEffect(() => {
    setPrefsState(loadPrefs(prefsKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setPrefs = (patch: Partial<KdsPrefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(prefsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const tvMode = prefs.tvMode;
  const tvPreset = prefs.tvPreset;
  const soundPrefs = prefs.sound;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, forceUpdate] = useState(0);

  const updateSoundPrefs = (patch: Partial<SoundPrefs>) => {
    setPrefs({ sound: { ...soundPrefs, ...patch } });
  };
  const changePreset = (p: TvPreset) => setPrefs({ tvPreset: p });

  const [now, setNow] = useState(() => new Date());

  // Tick a cada 15s: atualiza relógio e tempos decorridos sem reload
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      forceUpdate(n => n + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const enterFullscreen = () =>
    document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
  const exitFullscreenSafe = () =>
    document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});

  const toggleTvMode = () => {
    const next = !tvMode;
    setPrefs({ tvMode: next, fullscreen: next ? true : prefs.fullscreen });
    if (next && !document.fullscreenElement) enterFullscreen();
  };

  const toggleFullscreen = () => {
    const next = !document.fullscreenElement;
    setPrefs({ fullscreen: next });
    if (next) enterFullscreen(); else exitFullscreenSafe();
  };

  // Sincroniza o estado real do fullscreen do browser com a pref persistida
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Restaura preferências ao carregar: tenta entrar em fullscreen se pref pedir
  // (browser exige gesto do usuário; se falhar silenciosamente, ok — restaura no 1º clique)
  useEffect(() => {
    if (prefs.fullscreen && !document.fullscreenElement) {
      enterFullscreen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  // Build a set of skip_kitchen category IDs (bebidas e demais marcadas)
  const skipKitchenCatIds = new Set(categories.filter((c: any) => c.skip_kitchen).map(c => c.id));
  const productCatMap = new Map(products.map((p: any) => [p.id, p.category_id]));

  const isKitchenItem = (item: any) => {
    const catId = productCatMap.get(item.product_id);
    if (!catId) return true; // sem produto vinculado: vai pra cozinha por segurança
    return !skipKitchenCatIds.has(catId);
  };

  // Filtra itens de bebida dentro de cada pedido e remove pedidos sem itens de cozinha
  const filteredOrders = allOrders
    .map((o: any) => ({
      ...o,
      order_items: (o.order_items || []).filter(isKitchenItem),
    }))
    .filter((o: any) => (o.order_items || []).length > 0);

  // Atualização em lote: quando batchMs > 0, agrupa mudanças em uma janela para evitar
  // re-renders frequentes na TV (ideal em horários de pico).
  const [batchedOrders, setBatchedOrders] = useState<any[]>(filteredOrders);
  const batchTimerRef = useRef<number | null>(null);
  const batchPayloadRef = useRef<any[]>(filteredOrders);
  useEffect(() => {
    batchPayloadRef.current = filteredOrders;
    if (!prefs.batchMs || prefs.batchMs <= 0) {
      setBatchedOrders(filteredOrders);
      return;
    }
    if (batchTimerRef.current != null) return; // já tem janela aberta
    batchTimerRef.current = window.setTimeout(() => {
      setBatchedOrders(batchPayloadRef.current);
      batchTimerRef.current = null;
    }, prefs.batchMs);
    return () => {
      if (batchTimerRef.current != null) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };
    // Atenção: dependemos do conteúdo serializado para detectar mudanças reais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filteredOrders.map((o: any) => [o.id, o.status, o.updated_at])), prefs.batchMs]);

  const orders = prefs.batchMs > 0 ? batchedOrders : filteredOrders;

  // ===== Som inteligente: dispara apenas para eventos críticos habilitados =====
  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const warnedIdsRef = useRef<Set<string>>(new Set()); // cruzou 10min
  const lateIdsRef = useRef<Set<string>>(new Set());   // cruzou 20min
  const initRef = useRef(false);
  const soundPrefsRef = useRef(soundPrefs);
  useEffect(() => { soundPrefsRef.current = soundPrefs; }, [soundPrefs]);

  // ===== Scroll persistente por coluna no Modo TV =====
  // Mantém posição estável entre re-renders provocados por novos pedidos / status updates.
  // Persistido em sessionStorage por usuário (não polui localStorage entre dias).
  const scrollKey = `kds_scroll:${user?.id ?? 'anon'}`;
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollMap = useRef<Record<string, number>>({});
  const winScrollRef = useRef<number>(0);

  // Carrega snapshot persistido na montagem
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(scrollKey);
      if (raw) {
        const data = JSON.parse(raw);
        scrollMap.current = data.cols || {};
        winScrollRef.current = data.win || 0;
      }
    } catch {}
  }, [scrollKey]);

  // Salva snapshot ao sair / antes de descarregar
  useEffect(() => {
    const persist = () => {
      try {
        sessionStorage.setItem(scrollKey, JSON.stringify({
          cols: scrollMap.current,
          win: window.scrollY,
        }));
      } catch {}
    };
    window.addEventListener('beforeunload', persist);
    return () => { persist(); window.removeEventListener('beforeunload', persist); };
  }, [scrollKey]);

  // Restaura scrollTop de cada coluna + janela após cada atualização de pedidos (Modo TV)
  useEffect(() => {
    if (!tvMode) return;
    requestAnimationFrame(() => {
      Object.entries(colRefs.current).forEach(([key, el]) => {
        if (el && scrollMap.current[key] != null) {
          el.scrollTop = scrollMap.current[key];
        }
      });
      if (winScrollRef.current) window.scrollTo({ top: winScrollRef.current });
    });
  });

  const handleColScroll = (key: string) => (e: React.UIEvent<HTMLDivElement>) => {
    scrollMap.current[key] = (e.currentTarget as HTMLDivElement).scrollTop;
  };

  useEffect(() => {
    if (!tvMode) return;
    const onWin = () => { winScrollRef.current = window.scrollY; };
    window.addEventListener('scroll', onWin, { passive: true });
    return () => window.removeEventListener('scroll', onWin);
  }, [tvMode]);

  const playBeep = (kind: 'new' | 'warn' | 'late') => {
    const prefs = soundPrefsRef.current;
    if (!prefs.enabled) return;
    if (kind === 'new' && !prefs.onNew) return;
    if (kind === 'warn' && !prefs.onWarn) return;
    if (kind === 'late' && !prefs.onLate) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      // Tons distintos por evento
      const seq = kind === 'late' ? [880, 660, 880, 660] : kind === 'warn' ? [660, 520] : [780, 1040];
      const dur = kind === 'late' ? 0.18 : 0.14;
      seq.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * (dur + 0.04);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(prefs.volume, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {}
  };

  // Detecta novos pedidos e cruzamentos de SLA (10/20min)
  useEffect(() => {
    const ids = new Set<string>();
    let newCount = 0, warnCount = 0, lateCount = 0;
    for (const o of allOrders as any[]) {
      ids.add(o.id);
      const isNew = o.status === 'new';
      const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
      // Novo pedido (após inicialização)
      if (initRef.current && isNew && !seenIdsRef.current.has(o.id)) newCount++;
      // SLA crossings (apenas se ainda não pronto)
      if (o.status !== 'ready' && o.status !== 'completed') {
        if (mins >= 10 && mins < 20 && !warnedIdsRef.current.has(o.id)) {
          if (initRef.current) warnCount++;
          warnedIdsRef.current.add(o.id);
        }
        if (mins >= 20 && !lateIdsRef.current.has(o.id)) {
          if (initRef.current) lateCount++;
          lateIdsRef.current.add(o.id);
          warnedIdsRef.current.add(o.id);
        }
      }
    }
    seenIdsRef.current = ids;
    if (!initRef.current) { initRef.current = true; return; }
    if (lateCount > 0) playBeep('late');
    else if (newCount > 0) playBeep('new');
    else if (warnCount > 0) playBeep('warn');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders, now]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    let finalStatus = newStatus;
    // Differentiate ready by order type
    if (finalStatus === 'ready') {
      const order = orders.find(o => o.id === orderId);
      if (order?.type === 'pickup') finalStatus = 'waiting_pickup';
    }
    await supabase.from('orders').update({ status: finalStatus }).eq('id', orderId);
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
    toast.success(`Pedido atualizado para ${finalStatus === 'waiting_pickup' ? 'aguardando retirada' : finalStatus}`);
  };



  const statusColumns = [
    { key: 'new', label: 'Novos', dot: 'bg-primary', headBg: 'bg-primary/10 text-primary', icon: AlertCircle, match: (o: any) => o.status === 'new' },
    { key: 'accepted', label: 'Aceitos', dot: 'bg-blue-500', headBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Clock, match: (o: any) => o.status === 'accepted' },
    { key: 'preparing', label: 'Preparando', dot: 'bg-warning', headBg: 'bg-warning/10 text-warning', icon: ChefHat, match: (o: any) => o.status === 'preparing' },
    { key: 'ready', label: 'Prontos', dot: 'bg-success', headBg: 'bg-success/10 text-success', icon: CheckCircle, match: (o: any) => o.status === 'ready' },
  ];

  const typeColumns = [
    { key: 'dine_in', label: 'Mesa', dot: 'bg-primary', headBg: 'bg-primary/10 text-primary', icon: Utensils, match: (o: any) => o.type === 'dine_in' },
    { key: 'pickup', label: 'Retirada', dot: 'bg-blue-500', headBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Store, match: (o: any) => o.type === 'pickup' },
    { key: 'delivery', label: 'Entrega', dot: 'bg-warning', headBg: 'bg-warning/10 text-warning', icon: Bike, match: (o: any) => o.type === 'delivery' },
    { key: 'other', label: 'Outros', dot: 'bg-muted-foreground', headBg: 'bg-muted text-muted-foreground', icon: LayoutGrid, match: (o: any) => !['dine_in','pickup','delivery'].includes(o.type) },
  ];

  const minsSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  const priorityColumns = [
    { key: 'late', label: 'Atrasados', dot: 'bg-destructive', headBg: 'bg-destructive/10 text-destructive', icon: Flame, match: (o: any) => o.status !== 'ready' && minsSince(o.created_at) >= 20 },
    { key: 'warn', label: 'Atenção', dot: 'bg-warning', headBg: 'bg-warning/10 text-warning', icon: AlertCircle, match: (o: any) => o.status !== 'ready' && minsSince(o.created_at) >= 10 && minsSince(o.created_at) < 20 },
    { key: 'normal', label: 'No prazo', dot: 'bg-blue-500', headBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Snowflake, match: (o: any) => o.status !== 'ready' && minsSince(o.created_at) < 10 },
    { key: 'ready', label: 'Prontos', dot: 'bg-success', headBg: 'bg-success/10 text-success', icon: CheckCircle, match: (o: any) => o.status === 'ready' },
  ];

  const activePreset: TvPreset = tvMode ? tvPreset : 'status';
  const columns =
    activePreset === 'type' ? typeColumns :
    activePreset === 'priority' ? priorityColumns :
    statusColumns;

  // Urgência baseada em minutos desde criação
  const getUrgency = (createdAt: string) => {
    const mins = minsSince(createdAt);
    if (mins >= 20) return { level: 'late', cls: 'ring-2 ring-destructive/60 shadow-[0_0_0_4px_hsl(var(--destructive)/0.08)]', badge: 'bg-destructive text-destructive-foreground' };
    if (mins >= 10) return { level: 'warn', cls: 'ring-2 ring-warning/50', badge: 'bg-warning/15 text-warning' };
    return { level: 'ok', cls: 'ring-1 ring-border/60', badge: 'bg-muted text-muted-foreground' };
  };

  const typeLabels: Record<string, string> = { delivery: '🛵 Entrega', pickup: '🏪 Retirada', dine_in: '🍽️ Mesa' };

  const clockText = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`min-h-screen bg-background ${tvMode ? 'tv-mode' : ''} ${prefs.lowMotion ? 'kds-low-motion' : ''}`}>
      <header className={`sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/60 flex items-center justify-between ${tvMode ? 'px-6 py-4' : 'px-4 py-3'}`}>
        <div className="flex items-center gap-3">
          {!tvMode && (
            <a href="/restaurant" className="flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-sm font-bold hover:bg-primary/90 transition-colors md:hidden">
              ←
            </a>
          )}
          <div className={`rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center ${tvMode ? 'h-14 w-14' : 'h-10 w-10'}`}>
            <ChefHat className={`text-primary ${tvMode ? 'h-7 w-7' : 'h-5 w-5'}`} />
          </div>
          <div className="leading-tight">
            <h1 className={`font-heading font-black tracking-tight ${tvMode ? 'text-3xl' : 'text-lg sm:text-xl'}`}>Cozinha</h1>
            <p className={`text-muted-foreground font-medium ${tvMode ? 'text-sm' : 'text-[11px]'}`}>
              {orders.length} pedido{orders.length !== 1 && 's'} ativo{orders.length !== 1 && 's'}
            </p>
          </div>
          {tvMode && (
            <div className="ml-6 hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-bold text-primary">AO VIVO</span>
              <span className="text-sm font-black text-foreground tabular-nums">{clockText}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`relative rounded-xl hover:bg-muted transition-colors flex items-center justify-center ${tvMode ? 'h-12 w-12' : 'h-10 w-10'}`}
                title="Configurar alertas sonoros">
                {soundPrefs.enabled ? (
                  <Volume2 className={`text-primary ${tvMode ? 'h-6 w-6' : 'h-5 w-5'}`} />
                ) : (
                  <VolumeX className={`text-muted-foreground ${tvMode ? 'h-6 w-6' : 'h-5 w-5'}`} />
                )}
                {soundPrefs.enabled && !soundPrefs.onNew && !soundPrefs.onWarn && !soundPrefs.onLate && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning ring-2 ring-card" title="Nenhum evento selecionado" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 overflow-hidden rounded-2xl">
              <div className="px-4 py-3 bg-primary/5 border-b border-border/60 flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="leading-tight">
                  <p className="font-heading font-black text-sm">Modo Silêncio Inteligente</p>
                  <p className="text-[11px] text-muted-foreground">Toca apenas eventos críticos</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Som ativado</p>
                    <p className="text-[11px] text-muted-foreground">Liga/desliga todos os alertas</p>
                  </div>
                  <Switch checked={soundPrefs.enabled} onCheckedChange={(v) => updateSoundPrefs({ enabled: v })} />
                </label>
                <div className={`space-y-2.5 pt-1 border-t border-border/50 transition-opacity ${soundPrefs.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground pt-2">Tocar quando</p>
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold">Pedido novo</p>
                        <p className="text-[11px] text-muted-foreground">Entrou na cozinha</p>
                      </div>
                    </div>
                    <Switch checked={soundPrefs.onNew} onCheckedChange={(v) => updateSoundPrefs({ onNew: v })} />
                  </label>
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full bg-warning shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold">Atenção (≥10 min)</p>
                        <p className="text-[11px] text-muted-foreground">Pedido se aproximando do limite</p>
                      </div>
                    </div>
                    <Switch checked={soundPrefs.onWarn} onCheckedChange={(v) => updateSoundPrefs({ onWarn: v })} />
                  </label>
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold">Atrasado (≥20 min)</p>
                        <p className="text-[11px] text-muted-foreground">Crítico — alerta urgente</p>
                      </div>
                    </div>
                    <Switch checked={soundPrefs.onLate} onCheckedChange={(v) => updateSoundPrefs({ onLate: v })} />
                  </label>
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Volume</p>
                      <span className="text-[11px] font-bold tabular-nums">{Math.round(soundPrefs.volume * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(soundPrefs.volume * 100)]}
                      onValueChange={(v) => updateSoundPrefs({ volume: (v[0] ?? 60) / 100 })}
                      min={0} max={100} step={5}
                    />
                  </div>
                  <button
                    onClick={() => playBeep('new')}
                    className="w-full mt-1 rounded-xl bg-muted hover:bg-muted/70 py-2 text-xs font-black flex items-center justify-center gap-2">
                    <Settings2 className="h-3.5 w-3.5" /> Testar som
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button onClick={toggleTvMode}
            className={`rounded-xl transition-colors flex items-center gap-2 px-3 ${tvMode ? 'h-12 bg-primary text-primary-foreground hover:bg-primary/90' : 'h-10 bg-muted hover:bg-muted/70 text-foreground'}`}
            title="Alternar modo TV">
            {tvMode ? <Monitor className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
            <span className={`font-black ${tvMode ? 'text-sm' : 'text-xs'} hidden sm:inline`}>{tvMode ? 'Sair TV' : 'Modo TV'}</span>
          </button>
          {!tvMode && (
            <button onClick={toggleFullscreen} className="h-10 w-10 rounded-xl hover:bg-muted transition-colors text-muted-foreground hidden sm:flex items-center justify-center" title="Tela cheia">
              {isFullscreen ? '⬜' : '⛶'}
            </button>
          )}
          {!tvMode && (
            <a href="/restaurant" className="text-sm text-primary font-bold hover:underline hidden md:inline ml-1">Painel →</a>
          )}
        </div>
      </header>

      {tvMode && (
        <div className="sticky top-[72px] z-20 bg-background/80 backdrop-blur-xl border-b border-border/40 px-4 py-2.5 flex items-center justify-center gap-2 overflow-x-auto">
          {([
            { id: 'status' as const, label: 'Por Status', icon: LayoutGrid },
            { id: 'type' as const, label: 'Por Tipo', icon: Truck },
            { id: 'priority' as const, label: 'Por Prioridade', icon: Flame },
          ]).map(p => {
            const active = tvPreset === p.id;
            return (
              <button key={p.id} onClick={() => changePreset(p.id)}
                className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}>
                <p.icon className="h-4 w-4" />
                {p.label}
              </button>
            );
          })}
          <span className="mx-1 h-6 w-px bg-border/60 shrink-0" aria-hidden />
          {/* Toggle ordenação dos pedidos dentro de cada coluna */}
          <div className="shrink-0 inline-flex rounded-full bg-muted p-1 ring-1 ring-border/50" role="group" aria-label="Modo de ordenação">
            {([
              { id: 'priority' as const, label: 'Prioridade' },
              { id: 'created' as const, label: 'Criação' },
            ]).map(opt => {
              const active = prefs.sortMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPrefs({ sortMode: opt.id })}
                  className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPrefs({ sortByDelay: !prefs.sortByDelay })}
            title="Reordena as colunas pelo pedido mais antigo aguardando"
            className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-all ${
              prefs.sortByDelay
                ? 'bg-destructive text-destructive-foreground shadow-md ring-2 ring-destructive/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <Clock className="h-4 w-4" />
            Por Atraso
          </button>
          <span className="mx-1 h-6 w-px bg-border/60 shrink-0" aria-hidden />
          {/* Modo Estável: reduz animações e atualiza pedidos em lote */}
          <button
            onClick={() => setPrefs({ lowMotion: !prefs.lowMotion, batchMs: !prefs.lowMotion ? 800 : 0 })}
            title="Reduz animações e atualiza pedidos em lote (800ms) para uma tela mais estável"
            aria-pressed={prefs.lowMotion}
            className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-all ${
              prefs.lowMotion
                ? 'bg-success text-white shadow-md ring-2 ring-success/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <Snowflake className="h-4 w-4" />
            {prefs.lowMotion ? 'Estável (lote 0,8s)' : 'Estável'}
          </button>
        </div>
      )}

      <div className={`grid gap-3 ${tvMode ? 'grid-cols-2 lg:grid-cols-4 gap-4 p-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 p-3 sm:p-4'}`}>
        {(() => {
          // Reordena colunas pelo maior tempo de espera quando "Por Atraso" está ativo no Modo TV.
          // Colunas finais (ready/completed) e colunas vazias vão para o fim.
          if (!tvMode || !prefs.sortByDelay) return columns;
          return [...columns].sort((a, b) => {
            const isFinalA = a.key === 'ready' || a.key === 'completed';
            const isFinalB = b.key === 'ready' || b.key === 'completed';
            if (isFinalA !== isFinalB) return isFinalA ? 1 : -1;
            const oldestA = orders.filter(o => a.match(o)).reduce((min, o) => Math.min(min, new Date(o.created_at).getTime()), Infinity);
            const oldestB = orders.filter(o => b.match(o)).reduce((min, o) => Math.min(min, new Date(o.created_at).getTime()), Infinity);
            return oldestA - oldestB; // mais antigo (maior atraso) primeiro
          });
        })().map(col => {
          const filtered = orders.filter(o => col.match(o));
          const colOrders = tvMode
            ? [...filtered].sort((a, b) => {
                const ta = new Date(a.created_at).getTime();
                const tb = new Date(b.created_at).getTime();
                if (prefs.sortMode === 'created') {
                  // Puramente por horário: mais antigos primeiro (ready: mais recentes primeiro)
                  return a.status === 'ready' && b.status === 'ready' ? tb - ta : ta - tb;
                }
                // Modo padrão: prioridade por status, depois tempo
                const prio: Record<string, number> = { pending: 0, accepted: 1, preparing: 2, ready: 3 };
                const pa = prio[a.status] ?? 99;
                const pb = prio[b.status] ?? 99;
                if (pa !== pb) return pa - pb;
                return a.status === 'ready' ? tb - ta : ta - tb;
              })
            : filtered;
          return (
            <div key={col.key} className={`flex flex-col bg-muted/30 rounded-3xl ring-1 ring-border/50 overflow-hidden ${tvMode ? 'h-[calc(100vh-7.5rem)]' : ''}`}>
              <div className={`flex items-center justify-between bg-card/80 backdrop-blur border-b border-border/60 ${tvMode ? 'px-5 py-4' : 'px-4 py-3'}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`rounded-full ${col.dot} animate-pulse ${tvMode ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'}`} />
                  <div className={`rounded-lg flex items-center justify-center ${col.headBg} ${tvMode ? 'h-10 w-10' : 'h-7 w-7'}`}>
                    <col.icon className={tvMode ? 'h-6 w-6' : 'h-4 w-4'} />
                  </div>
                  <span className={`font-heading font-black tracking-tight truncate ${tvMode ? 'text-xl' : 'text-sm'}`}>{col.label}</span>
                </div>
                {(() => {
                  // Severidade só importa em colunas "ativas" (não em pronto/finalizado).
                  const isActive = col.key !== 'ready' && col.key !== 'completed';
                  const count = colOrders.length;
                  const lateCount = isActive
                    ? colOrders.filter(o => (Date.now() - new Date(o.created_at).getTime()) / 60000 >= 20).length
                    : 0;
                  const critical = tvMode && isActive && (count >= 10 || lateCount >= 3);
                  const warn = tvMode && isActive && !critical && (count >= 5 || lateCount >= 1);
                  const sevCls = critical
                    ? 'bg-destructive text-destructive-foreground ring-destructive/40 animate-pulse'
                    : warn
                      ? 'bg-warning text-white ring-warning/40'
                      : col.headBg;
                  return (
                    <div className="flex items-center gap-1.5">
                      {tvMode && lateCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground px-2 py-1 text-xs font-black ring-2 ring-destructive/30 animate-pulse"
                          title={`${lateCount} pedido(s) atrasado(s) (≥20min)`}
                          aria-label={`${lateCount} atrasados`}
                        >
                          <Clock className="h-3 w-3" />
                          {lateCount}
                        </span>
                      )}
                      <span
                        className={`font-heading font-black tabular-nums leading-none transition-colors ${sevCls} ${
                          tvMode
                            ? `rounded-2xl px-4 py-2 text-3xl min-w-[3rem] text-center ring-2 shadow-sm ${critical ? 'shadow-destructive/40' : ''}`
                            : 'rounded-full px-2.5 py-0.5 text-xs'
                        }`}
                        aria-label={`${count} pedidos em ${col.label}${critical ? ' (crítico)' : warn ? ' (atenção)' : ''}`}
                      >
                        {count}
                        {critical && tvMode && (
                          <span className="ml-1 inline-block animate-bounce" aria-hidden>⚠</span>
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div
                ref={(el) => { colRefs.current[col.key] = el; }}
                onScroll={handleColScroll(col.key)}
                className={`flex-1 p-2.5 space-y-2.5 min-h-[200px] ${tvMode ? 'overflow-y-auto scrollbar-thin' : ''}`}
              >
                {colOrders.map(order => {
                  const items = (order as any).order_items || [];
                  const elapsed = getElapsed(order.created_at);
                  const urg = getUrgency(order.created_at);
                  return (
                    <div key={order.id} className={`bg-card rounded-2xl p-3.5 space-y-2.5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${urg.cls}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-heading font-black text-xl tracking-tight">#{order.number}</span>
                          <span className="text-xs font-bold text-muted-foreground truncate">{typeLabels[order.type] || order.type}</span>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${urg.badge}`}>
                          {elapsed}
                        </span>
                      </div>
                      {(order.customer_name || order.table_id) && (
                        <div className="flex items-center gap-1.5 text-xs">
                          {order.customer_name && <span className="font-bold truncate">{order.customer_name}</span>}
                          <span className="text-muted-foreground">· {formatTime(order.created_at)}</span>
                        </div>
                      )}
                      <div className="rounded-xl bg-muted/40 p-2 divide-y divide-border/40">
                        {items.map((item: any) => (
                          <div key={item.id} className="py-1.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                            <span className="shrink-0 inline-flex items-center justify-center min-w-[24px] h-6 rounded-md bg-primary/10 text-primary text-xs font-black px-1.5">
                              {item.qty}×
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-bold leading-tight">{item.name}</span>
                              {item.options && Array.isArray(item.options) && item.options.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {item.options.map((opt: any, oi: number) => (
                                    <p key={oi} className="text-[11px] text-muted-foreground leading-tight">+ {opt.name}</p>
                                  ))}
                                </div>
                              )}
                              {item.notes && <p className="text-[11px] font-bold text-warning mt-1 bg-warning/10 rounded-md px-1.5 py-0.5 inline-block">⚠ {item.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {order.notes && <p className="text-xs font-medium bg-warning/10 text-warning rounded-lg px-2.5 py-1.5">📝 {order.notes}</p>}
                      <div className="flex gap-2 pt-0.5">
                        {order.status === 'new' && (
                          <button onClick={() => updateStatus(order.id, 'accepted')}
                            className="flex-1 rounded-xl bg-blue-500 py-2.5 text-xs font-black text-white hover:bg-blue-600 active:scale-[0.98] transition-all shadow-sm">
                            ✓ Aceitar
                          </button>
                        )}
                        {order.status === 'accepted' && (
                          <button onClick={() => updateStatus(order.id, 'preparing')}
                            className="flex-1 rounded-xl bg-warning py-2.5 text-xs font-black text-white hover:bg-warning/90 active:scale-[0.98] transition-all shadow-sm">
                            🔥 Preparar
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => updateStatus(order.id, 'ready')}
                            className="flex-1 rounded-xl bg-success py-2.5 text-xs font-black text-white hover:bg-success/90 active:scale-[0.98] transition-all shadow-sm">
                            ✓ Pronto!
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <>
                            {order.type === 'delivery' && (
                              <a href="/restaurant/orders"
                                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-black text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm text-center">
                                🛵 Enviar Entregador
                              </a>
                            )}
                            {order.type !== 'delivery' && (
                              <button onClick={() => updateStatus(order.id, 'completed')}
                                className="flex-1 rounded-xl bg-foreground py-2.5 text-xs font-black text-background hover:bg-foreground/90 active:scale-[0.98] transition-all shadow-sm">
                                Concluir
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {colOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10 px-3">
                    <div className={`h-12 w-12 rounded-2xl ${col.headBg} flex items-center justify-center mb-2 opacity-60`}>
                      <col.icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium">Nenhum pedido</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
