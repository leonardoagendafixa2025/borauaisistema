import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowRight, Check, Smartphone, BarChart3, Zap, QrCode,
  Bell, Utensils, ShieldCheck, Sparkles,
  Truck, Split, Send, Bot, WifiOff, MessageSquare,
  Disc3, Music, Activity, Brain, TrendingUp, Star,
  Flame, Receipt, CreditCard, Eye,
  ChefHat, MapPin,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { SEO } from '@/components/seo/SEO';
import logoImg from '@/assets/logo.png';
import heroWaiter from '@/assets/hero-waiter.jpg';
import sertanejoShow from '@/assets/sertanejo-show.jpg';

const FALLBACK_PLANS = [
  {
    id: 'fallback-basic', name: 'Básico', tier: 'basic', price: 69.99, active: true,
    description: 'Para começar com tudo o que importa.',
    features: ['Cardápio digital com QR Code', 'Pedidos por mesa', 'Painel da cozinha (KDS)', 'Comandas individuais', 'Relatórios básicos', 'Suporte por e-mail'],
  },
  {
    id: 'fallback-pro', name: 'Profissional', tier: 'pro', price: 119.99, active: true,
    description: 'Para bares e restaurantes em crescimento.',
    features: ['Tudo do Básico', 'Delivery + retirada', 'Controle de estoque', 'CRM de clientes', 'Notificações WhatsApp', 'Multi-usuários', 'Relatórios avançados'],
  },
  {
    id: 'fallback-premium', name: 'Premium', tier: 'premium', price: 199.99, active: true,
    description: 'Para casas noturnas e operações completas.',
    features: ['Tudo do Profissional', 'Modo Balada (line-up, DJ)', 'Pulseiras cashless', 'Pedidos de música', 'Integração Telegram', 'Bot inteligente', 'Suporte prioritário 24/7'],
  },
];
export default function Index() {
  const { data: plansRaw } = useQuery({
    queryKey: ['public-plans-v2'],
    queryFn: async () => {
      try { localStorage.removeItem('home_plans_cache_v1'); } catch {}
      const { data, error } = await publicSupabase
        .from('subscription_plans')
        .select('*')
        .eq('active', true)
        .order('price');
      if (error) throw error;
      const filtered = ((data || []) as any[]).filter(
        (p: any) => !p.name?.toLowerCase().includes('teste') && p.tier !== 'basic_test' && Number(p.price) >= 30
      );
      return filtered;
    },
    refetchOnMount: 'always',
    staleTime: 30_000,
    retry: 1,
  });
  const plans = (plansRaw && plansRaw.length > 0) ? plansRaw : FALLBACK_PLANS;

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

  const [statIdx, setStatIdx] = useState(0);
  const liveStats = [
    { label: 'pedidos hoje', value: '2.847', icon: Receipt },
    { label: 'mesas ativas agora', value: '184', icon: Utensils },
    { label: 'músicas tocadas', value: '12.3k', icon: Music },
    { label: 'bares na plataforma', value: '+520', icon: Flame },
  ];
  useEffect(() => {
    const t = setInterval(() => setStatIdx(i => (i + 1) % liveStats.length), 2400);
    return () => clearInterval(t);
  }, []);

  const [momentIdx, setMomentIdx] = useState(0);
  const moments = [
    { word: 'no almoço', color: 'from-[#FF5757] to-[#FF8A65]' },
    { word: 'no happy hour', color: 'from-amber-500 to-[#FF5757]' },
    { word: 'no rolê da galera', color: 'from-cyan-500 to-blue-500' },
    { word: 'na balada', color: 'from-purple-500 to-pink-500' },
    { word: 'no delivery', color: 'from-emerald-500 to-[#FF5757]' },
  ];
  useEffect(() => {
    const t = setInterval(() => setMomentIdx(i => (i + 1) % moments.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-body overflow-x-hidden">
      <SEO
        title="Bora Uai — Sistema para bares, restaurantes e baladas"
        description="Cardápio QR, comanda eletrônica, KDS, delivery, caixa, estoque e Modo Balada. Tudo num só sistema. Teste 14 dias grátis, sem cartão."
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Bora Uai',
            url: 'https://borauai.com',
            logo: 'https://borauai.com/favicon.png',
            sameAs: [],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Bora Uai',
            url: 'https://borauai.com',
            inLanguage: 'pt-BR',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://borauai.com/ajuda?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />
      {/* Soft animated background blobs (light) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#FF5757]/15 blur-[120px] animate-pulse-slow" />
        <div className="absolute top-[40%] -right-40 w-[500px] h-[500px] rounded-full bg-purple-300/25 blur-[120px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-cyan-200/30 blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* ═══════════════ NAV ═══════════════ */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16 sm:h-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src={logoImg} alt="Bora Uai" className="h-10 sm:h-12 w-10 sm:w-12 rounded-xl object-contain shadow-md shadow-black/10 group-hover:scale-105 transition-transform" />
            <span className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight text-foreground">
              Bora <span className="text-[#FF5757]">Uai</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#modalidades" className="hover:text-foreground transition-colors">Modalidades</a>
            <a href="#inteligencia" className="hover:text-foreground transition-colors">IA & Bot</a>
            <Link to="/precos" className="hover:text-foreground transition-colors">Preços</Link>
            <Link to="/ajuda" className="hover:text-foreground transition-colors">Ajuda</Link>
            
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/restaurant/login" className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2">
              Entrar
            </Link>
            <Link to="/cadastro" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF5757] to-[#FF8A65] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#FF5757]/30 hover:shadow-xl hover:shadow-[#FF5757]/50 hover:scale-[1.03] active:scale-95 transition-all">
              Teste 14 dias grátis
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative z-10 pt-10 sm:pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
            {/* LEFT — copy */}
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start mb-6 animate-fade-in">
                <div className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-1.5 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-semibold text-foreground/80">
                    {liveStats[statIdx].value} {liveStats[statIdx].label} • ao vivo
                  </span>
                </div>
              </div>

              <h1 className="font-heading font-black tracking-tight text-5xl sm:text-6xl md:text-7xl leading-[0.95] animate-fade-in">
                <span className="block text-foreground">O sistema que</span>
                <span className="block text-foreground">não dorme —</span>
                <span className="relative block h-[1.05em] overflow-hidden">
                  {moments.map((m, i) => (
                    <span
                      key={m.word}
                      className={`absolute inset-0 bg-gradient-to-r ${m.color} bg-clip-text text-transparent transition-all duration-700 ${
                        i === momentIdx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                      }`}
                    >
                      {m.word}.
                    </span>
                  ))}
                </span>
              </h1>

              <p className="mt-7 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in" style={{ animationDelay: '0.1s' }}>
                Um só painel pra <span className="text-[#FF5757] font-semibold">delivery</span>,{' '}
                <span className="text-cyan-600 font-semibold">QR na mesa</span> e{' '}
                <span className="text-purple-600 font-semibold">balada</span>.
                Com IA que te avisa o que vender, bot do Telegram e KDS de verdade.
                <span className="text-foreground font-semibold"> Zero taxa por pedido.</span>
              </p>

              <div className="mt-9 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <Link to="/cadastro" className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF5757] to-[#FF8A65] px-8 py-4 text-base font-bold text-white shadow-2xl shadow-[#FF5757]/40 hover:shadow-[#FF5757]/60 hover:scale-[1.03] active:scale-95 transition-all">
                  Começar grátis por 14 dias
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#modalidades" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-card border border-border px-8 py-4 text-base font-semibold text-foreground hover:bg-muted transition-all">
                  Ver demonstrações
                </a>
              </div>

              <p className="mt-5 text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: '0.3s' }}>
                ✓ Sem cartão de crédito  •  ✓ Cancela quando quiser  •  ✓ Suporte humano em PT-BR
              </p>
            </div>

            {/* RIGHT — waiter photo + floating phone */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none animate-fade-in" style={{ animationDelay: '0.15s' }}>
              {/* Glow behind */}
              <div className="absolute -inset-6 bg-gradient-to-tr from-[#FF5757]/30 via-purple-400/20 to-cyan-300/30 blur-3xl rounded-[3rem]" />

              {/* Waiter photo */}
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-[#FF5757]/20 border border-border/40 aspect-[4/5]">
                <img
                  src={heroWaiter}
                  alt="Garçom usando o Bora Uai em um bar moderno"
                  className="w-full h-full object-cover"
                  width={1080}
                  height={1350}
                />
                {/* subtle gradient overlay for legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {/* Floating live stat top-left */}
                <div className="absolute top-5 left-5 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-xl px-3.5 py-2.5 flex items-center gap-2.5 animate-float-soft">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Em tempo real</div>
                    <div className="text-xs font-extrabold text-foreground">+18% vendas hoje</div>
                  </div>
                </div>

                {/* Floating Telegram card bottom-left */}
                <div className="absolute bottom-5 left-5 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-xl px-3.5 py-2.5 flex items-center gap-2.5"
                     style={{ animation: 'float 4s ease-in-out infinite', animationDelay: '0.6s' }}>
                  <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-600">
                    <Send className="h-4 w-4" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Telegram</div>
                    <div className="text-xs font-extrabold text-foreground">/relatorio enviado</div>
                  </div>
                </div>
              </div>

              {/* Floating phone mockup */}
              <div
                className="absolute -right-2 sm:-right-6 lg:-right-10 -bottom-8 w-40 sm:w-48 lg:w-56 rotate-[6deg] hover:rotate-[3deg] transition-transform duration-500"
                style={{ animation: 'float 5s ease-in-out infinite' }}
              >
                <div className="relative rounded-[2rem] bg-foreground p-2 shadow-2xl shadow-black/40 ring-1 ring-white/10">
                  <div className="rounded-[1.5rem] overflow-hidden bg-background aspect-[9/19]">
                    {/* Notch */}
                    <div className="h-5 bg-foreground flex items-center justify-center">
                      <div className="h-1 w-12 bg-background/40 rounded-full" />
                    </div>
                    {/* Phone screen content */}
                    <div className="p-2.5 space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#FF5757] to-[#FF8A65] flex items-center justify-center">
                          <Utensils className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[8px] font-extrabold text-foreground leading-tight">Boteco do Zé</div>
                          <div className="text-[6px] text-muted-foreground leading-tight">Mesa 12 • Aberta</div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-orange-50 border border-orange-100 p-2">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-2.5 w-2.5 text-orange-600" />
                          <div className="text-[7px] font-bold text-foreground">Pedido #1287</div>
                        </div>
                        <div className="text-[6px] text-muted-foreground mt-0.5">2x Chopp • R$ 24,00</div>
                      </div>
                      <div className="rounded-lg bg-purple-50 border border-purple-100 p-2">
                        <div className="flex items-center gap-1.5">
                          <Music className="h-2.5 w-2.5 text-purple-600" />
                          <div className="text-[7px] font-bold text-foreground">Música pedida</div>
                        </div>
                        <div className="text-[6px] text-muted-foreground mt-0.5">Tropicália • +R$ 5</div>
                      </div>
                      <div className="rounded-lg bg-cyan-50 border border-cyan-100 p-2">
                        <div className="flex items-center gap-1.5">
                          <QrCode className="h-2.5 w-2.5 text-cyan-600" />
                          <div className="text-[7px] font-bold text-foreground">QR Mesa 8</div>
                        </div>
                        <div className="text-[6px] text-muted-foreground mt-0.5">Conta dividida 4x</div>
                      </div>
                      <div className="rounded-lg bg-gradient-to-r from-[#FF5757] to-[#FF8A65] p-2 text-center">
                        <div className="text-[7px] font-extrabold text-white">Faturamento hoje</div>
                        <div className="text-[10px] font-black text-white leading-none mt-0.5">R$ 4.870</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TRUST STRIP ═══════════════ */}
      <section className="relative z-10 py-12 border-y border-border bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Tudo que seu bar, restaurante ou balada precisa, num só lugar
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-muted-foreground">
            {[
              { icon: Truck, label: 'Delivery próprio' },
              { icon: QrCode, label: 'QR Mesa' },
              { icon: Disc3, label: 'Modo Balada' },
              { icon: ChefHat, label: 'KDS Cozinha' },
              { icon: CreditCard, label: 'PDV Caixa' },
              { icon: Brain, label: 'IA Insights' },
              { icon: Send, label: 'Bot Telegram' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ MODALIDADES ═══════════════ */}
      <section id="modalidades" className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FF5757]/10 border border-[#FF5757]/20 px-4 py-1.5 mb-5">
              <Sparkles className="h-3.5 w-3.5 text-[#FF5757]" />
              <span className="text-xs font-bold text-[#FF5757] uppercase tracking-wider">3 modos, 1 plataforma</span>
            </div>
            <h2 className="font-heading font-black text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground">
              Funciona pro seu bar ou restaurante<br/>
              <span className="bg-gradient-to-r from-[#FF5757] to-purple-500 bg-clip-text text-transparent">
                em todos os turnos.
              </span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
              Do almoço delivery, ao happy-hour na mesa, à noite de DJ na balada.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* DELIVERY */}
            <div className="group relative rounded-3xl bg-card border border-orange-200 p-8 hover:border-orange-400 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/10 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-orange-200/50 blur-3xl" />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 mb-6 shadow-lg shadow-orange-500/30">
                  <Truck className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-heading font-black text-2xl text-foreground mb-2">Delivery próprio</h3>
                <p className="text-sm text-muted-foreground mb-6">Cardápio digital sem taxa por pedido. Cliente pede, você entrega, você fica com tudo.</p>
                <ul className="space-y-3 text-sm mb-6">
                  {[
                    'Catálogo com fotos, modificadores e combos',
                    'Gestão de entregadores própria',
                    'CRM automático: histórico, ranking, fidelidade',
                    'Rastreio em tempo real pro cliente',
                    'PIX, dinheiro, cartão na entrega',
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground/80">
                      <Check className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/boteco-do-ze"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Ver demo do delivery
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* QR MESA */}
            <div className="group relative rounded-3xl bg-card border-2 border-cyan-300 p-8 hover:border-cyan-500 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/15 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-cyan-200/60 blur-3xl" />
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-cyan-500 text-[10px] font-black text-white uppercase tracking-wider shadow-md">
                Mais usado
              </div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 mb-6 shadow-lg shadow-cyan-500/30">
                  <QrCode className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-heading font-black text-2xl text-foreground mb-2">QR Mesa</h3>
                <p className="text-sm text-muted-foreground mb-6">Cliente escaneia, pede, divide a conta. Garçom só serve. KDS recebe direto.</p>
                <ul className="space-y-3 text-sm mb-6">
                  {[
                    'Comandas individuais por cliente',
                    'Dividir conta: igual ou por item',
                    'Chamar garçom com 1 toque',
                    'Couvert e taxa de serviço configurável',
                    'Tela "Minha Mesa" ao vivo, sem login',
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground/80">
                      <Check className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/boteco-do-ze/mesa/1"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Ver demo da mesa (QR)
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SHOWCASE BALADA ═══════════════ */}
      <section className="relative z-10 py-24 sm:py-32 border-t border-border bg-gradient-to-b from-background via-purple-50/40 to-background overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-purple-300/30 blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-pink-300/30 blur-[120px] animate-pulse-slow" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
            {/* Visual */}
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-6 bg-gradient-to-br from-purple-500/40 via-pink-500/30 to-transparent rounded-[2.5rem] blur-2xl" />
              <div className="relative">
                <img
                  src={sertanejoShow}
                  alt="Show sertanejo ao vivo no Modo Balada"
                  width={1280}
                  height={1280}
                  loading="lazy"
                  className="relative rounded-[2rem] shadow-2xl shadow-purple-500/30 w-full object-cover aspect-square"
                />
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                <div className="absolute top-5 left-5 backdrop-blur-xl bg-black/50 border border-white/20 rounded-2xl px-4 py-2.5 shadow-xl animate-float">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping" />
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-white/70 font-bold">Tocando agora</div>
                      <div className="text-xs font-bold text-white">Evidências — Chitãozinho</div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-5 right-5 backdrop-blur-xl bg-gradient-to-br from-pink-500/90 to-purple-600/90 border border-white/20 rounded-2xl px-4 py-3 shadow-xl animate-float" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-2.5">
                    <Flame className="h-5 w-5 text-yellow-300" />
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-white/80 font-bold">Hour Drink • 23:47</div>
                      <div className="text-xs font-black text-white">Caipirinha R$ 12 →</div>
                    </div>
                  </div>
                </div>

                <div className="absolute -left-3 sm:-left-6 bottom-20 backdrop-blur-xl bg-white/95 border border-purple-200 rounded-2xl px-3 py-2 shadow-xl animate-float" style={{ animationDelay: '0.5s' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Music className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-purple-700 font-bold">Fila DJ</div>
                      <div className="text-xs font-black text-foreground tabular-nums">12 pedidos</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/30 px-4 py-1.5 mb-5">
                <Disc3 className="h-3.5 w-3.5 text-purple-600 animate-spin-slow" />
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Modo Balada</span>
              </div>

              <h2 className="font-heading font-black text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground leading-[1.05] mb-6">
                Quando o palco acende,<br/>
                <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent">
                  o caixa também.
                </span>
              </h2>

              <p className="text-lg text-muted-foreground mb-8 max-w-xl">
                Show sertanejo, DJ, forró ou pagode — vire a chave às 22h e seu bar
                vira pista. Cliente pede música, garante o drink da hora e divide a
                conta sem chamar garçom.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  { icon: Music, t: 'Pedidos de música com aprovação do DJ', d: 'Cliente paga pra furar a fila. Direto na comanda.' },
                  { icon: Flame, t: 'Hour Drink com countdown ao vivo', d: 'Promoção das 23h às 00h em todas as telas.' },
                  { icon: Sparkles, t: 'Line-up público em /balada', d: 'Banda das 21h, DJ residente das 00h.' },
                  { icon: Split, t: 'Rateio de música na mesa', d: '4 amigos dividem o pedido entre as 4 comandas.' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 group">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 border border-purple-300/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <item.icon className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground text-sm">{item.t}</div>
                      <div className="text-xs text-muted-foreground">{item.d}</div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/demo/balada"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all"
                >
                  Ver demo da pista ao vivo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#planos"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-purple-300 bg-card px-6 py-3 text-sm font-bold text-purple-700 hover:bg-purple-50 transition-all"
                >
                  Plano com Modo Balada
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ INTELIGÊNCIA ═══════════════ */}
      <section id="inteligencia" className="relative z-10 py-24 sm:py-32 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-4 py-1.5 mb-5">
              <Brain className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Inteligência embarcada</span>
            </div>
            <h2 className="font-heading font-black text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground">
              O bar trabalha.<br/>
              <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
                A gente avisa o que importa.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TELEGRAM BOT */}
            <div className="relative rounded-3xl bg-card border border-cyan-200 p-8 lg:p-10 overflow-hidden shadow-sm">
              <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-cyan-200/40 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/30">
                    <Send className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-2xl text-foreground">Bot Telegram</h3>
                    <p className="text-xs text-cyan-700 font-semibold">Gerencie pelo celular</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-cyan-500 px-4 py-2.5 text-sm text-white shadow-sm">
                    /relatorio
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted border border-border px-4 py-3 text-sm text-foreground/90">
                    📊 <b>Hoje • 17:42</b><br/>
                    💰 R$ 4.280 (+18%)<br/>
                    🍔 87 pedidos<br/>
                    ⭐ Top: X-Bacon (R$ 612)<br/>
                    🪑 12/16 mesas ocupadas
                  </div>
                  <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-cyan-500 px-4 py-2.5 text-sm text-white shadow-sm">
                    /fechar
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted border border-border px-4 py-3 text-sm text-foreground/90">
                    ✅ Restaurante fechado para novos pedidos.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {['/relatorio', '/comandas', '/abrir', '/fechar', 'resumo 22h diário'].map((cmd, i) => (
                    <span key={i} className="text-xs font-mono px-2.5 py-1 rounded-lg bg-muted border border-border text-cyan-700">
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* IA INSIGHTS */}
            <div className="relative rounded-3xl bg-card border border-purple-200 p-8 lg:p-10 overflow-hidden shadow-sm">
              <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-purple-200/40 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-2xl text-foreground">IA Insights</h3>
                    <p className="text-xs text-purple-700 font-semibold">Decisões orientadas por dados</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', text: 'Sua venda de chopp cai 40% nas terças. Sugerimos promo "2x1 das 18h-20h".' },
                    { icon: Eye, color: 'text-amber-600', bg: 'bg-amber-50', text: 'Cliente João (R$ 1.840 em 30d) não pede há 12 dias. Mande cupom?' },
                    { icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50', text: 'Sexta às 21h tem fila no KDS. Aumente cozinheiro ou simplifique cardápio.' },
                    { icon: Star, color: 'text-cyan-600', bg: 'bg-cyan-50', text: 'X-Bacon tem margem 68%. É seu produto-âncora — destaque no topo.' },
                  ].map((i, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-2xl bg-muted/50 border border-border p-4 hover:bg-muted transition-all">
                      <div className={`p-2 rounded-lg ${i.bg} ${i.color} shrink-0`}>
                        <i.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{i.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FUNCIONALIDADES ═══════════════ */}
      <section id="funcionalidades" className="relative z-10 py-24 sm:py-32 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="font-heading font-black text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground">
              Não falta <span className="text-[#FF5757]">nada.</span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
              Tudo que sistemas grandes têm — sem o preço enterprise.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: ChefHat, title: 'KDS Cozinha', desc: 'Tela TV mode, som, presets', color: 'from-orange-400 to-red-500' },
              { icon: CreditCard, title: 'PDV Caixa', desc: 'Sessão, sangria, fechamento', color: 'from-emerald-400 to-teal-500' },
              { icon: Smartphone, title: 'Garçom PWA', desc: 'Offline-first, instala no celular', color: 'from-blue-400 to-cyan-500' },
              { icon: Split, title: 'Comandas', desc: 'Individuais, dividir conta', color: 'from-purple-400 to-pink-500' },
              { icon: BarChart3, title: 'Dashboard ao vivo', desc: 'KPIs, despesas, top produtos', color: 'from-amber-400 to-orange-500' },
              { icon: Bell, title: 'Notificações', desc: 'Web Audio, push, Telegram', color: 'from-rose-400 to-red-500' },
              { icon: WifiOff, title: 'Modo offline', desc: 'Garçom funciona sem internet', color: 'from-slate-400 to-gray-500' },
              { icon: Receipt, title: 'Impressão 80mm', desc: 'Cozinha, caixa, comprovante', color: 'from-indigo-400 to-purple-500' },
              { icon: ShieldCheck, title: 'Multi-usuário', desc: 'Dono, gerente, garçom, cozinha', color: 'from-green-400 to-emerald-500' },
              { icon: Zap, title: 'Estoque', desc: 'Alerta mínimo, sold-out auto', color: 'from-yellow-400 to-amber-500' },
              { icon: MapPin, title: 'Entregadores', desc: 'CRUD, status, atribuição', color: 'from-pink-400 to-rose-500' },
              { icon: MessageSquare, title: 'WhatsApp', desc: 'Notifica cliente automaticamente', color: 'from-green-500 to-emerald-600' },
            ].map((f, i) => (
              <div key={i} className="group rounded-2xl bg-card border border-border p-4 sm:p-5 hover:border-[#FF5757]/30 hover:shadow-md transition-all hover:-translate-y-1">
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${f.color} mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-sm text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMO FUNCIONA ═══════════════ */}
      <section className="relative z-10 py-24 sm:py-32 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="font-heading font-black text-4xl sm:text-5xl tracking-tight text-foreground">
              Em <span className="text-[#FF5757]">5 minutos</span> seu bar tá no ar.
            </h2>
          </div>
          <div className="space-y-4">
            {[
              { n: '01', title: 'Crie sua conta', desc: 'Sem cartão. 14 dias grátis. Slug exclusivo (ex: borauai.app/seurestaurante).' },
              { n: '02', title: 'Monte seu cardápio', desc: 'Categorias em árvore, fotos, modificadores, combos, ações em massa.' },
              { n: '03', title: 'Imprima os QR Codes', desc: 'Um QR por mesa. Cliente escaneia e já vê seu cardápio.' },
              { n: '04', title: 'Conecte o Telegram', desc: 'Mande /start no bot, receba alertas e gerencie pelo celular.' },
              { n: '05', title: 'Comece a vender', desc: 'KDS impresso, garçom PWA, balada à noite. Tudo conectado.' },
            ].map((s, i) => (
              <div key={i} className="group flex items-start gap-5 rounded-2xl bg-card border border-border p-6 hover:border-[#FF5757]/30 hover:shadow-md transition-all">
                <div className="font-heading font-black text-4xl bg-gradient-to-br from-[#FF5757] to-purple-500 bg-clip-text text-transparent shrink-0 w-16">
                  {s.n}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-bold text-lg text-foreground mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PLANOS ═══════════════ */}
      <section id="planos" className="relative z-10 py-24 sm:py-32 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 mb-5">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sem taxa por pedido. Sempre.</span>
            </div>
            <h2 className="font-heading font-black text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground">
              Escolha seu plano.<br/>
              <span className="bg-gradient-to-r from-[#FF5757] to-purple-500 bg-clip-text text-transparent">
                Cresça sem limite.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p: any, idx: number) => {
              const isPro = idx === 1;
              return (
                <div key={p.id}
                  className={`relative rounded-3xl p-8 transition-all hover:-translate-y-2 ${
                    isPro
                      ? 'bg-gradient-to-br from-[#FF5757]/5 to-purple-500/5 border-2 border-[#FF5757] shadow-2xl shadow-[#FF5757]/20 lg:scale-105'
                      : 'bg-card border border-border hover:border-foreground/20 hover:shadow-md'
                  }`}>
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#FF5757] to-purple-500 text-[10px] font-black text-white uppercase tracking-widest shadow-lg">
                      Mais popular
                    </div>
                  )}
                  <h3 className="font-heading font-black text-2xl text-foreground mb-2">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">{p.description || 'Tudo que seu bar precisa.'}</p>
                  <div className="mb-6">
                    <span className="text-5xl font-heading font-black text-foreground">{fmt(p.price)}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                  <Link to="/cadastro"
                    className={`block w-full text-center rounded-xl py-3.5 text-sm font-bold transition-all ${
                      isPro
                        ? 'bg-gradient-to-r from-[#FF5757] to-[#FF8A65] text-white shadow-lg shadow-[#FF5757]/30 hover:shadow-xl hover:scale-[1.02]'
                        : 'bg-foreground text-background hover:bg-foreground/90'
                    }`}>
                    Começar grátis
                  </Link>
                  {p.features && Array.isArray(p.features) && (
                    <ul className="mt-6 space-y-3">
                      {p.features.slice(0, 8).map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                          <Check className={`h-4 w-4 shrink-0 mt-0.5 ${isPro ? 'text-[#FF5757]' : 'text-emerald-600'}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8">
            14 dias grátis em todos os planos • Sem fidelidade • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-3xl bg-gradient-to-br from-[#FF5757] via-[#FF8A65] to-purple-500 p-10 sm:p-16 text-center overflow-hidden shadow-2xl shadow-[#FF5757]/30">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full bg-white blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full bg-purple-300 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="font-heading font-black text-4xl sm:text-5xl md:text-6xl text-white tracking-tight">
                Bora botar seu bar ou restaurante<br/>no século XXI?
              </h2>
              <p className="mt-5 text-lg text-white/90 max-w-xl mx-auto">
                14 dias grátis. Sem cartão. Cancele a hora que quiser.
              </p>
              <Link to="/cadastro" className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-black text-[#FF5757] shadow-2xl hover:shadow-3xl hover:scale-105 active:scale-95 transition-all">
                Começar agora — é grátis
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="relative z-10 border-t border-border py-6 md:py-8 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4 md:space-y-5">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <a
              href="https://wa.me/5531991988796?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20Bora%20Uai"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              💬 Vendas: (31) 99198-8796
            </a>
            <a href="mailto:toyesterdayagencia@gmail.com" className="hover:text-foreground transition-colors">
              ✉️ toyesterdayagencia@gmail.com
            </a>
            <Link to="/ajuda" className="hover:text-foreground transition-colors">Ajuda</Link>
            <Link to="/precos" className="hover:text-foreground transition-colors">Preços</Link>
            <Link to="/restaurant/login" className="hover:text-foreground transition-colors">Restaurante</Link>
            <Link to="/garcom/login" className="hover:text-foreground transition-colors">Garçom</Link>
            <Link to="/entregador" className="hover:text-foreground transition-colors">Entregador</Link>
            <Link to="/cliente/login" className="hover:text-foreground transition-colors">Minha conta</Link>
            <Link to="/master/login" className="hover:text-foreground transition-colors">Admin</Link>
            <a href="/borauai.apk" download="borauai.apk" className="hover:text-primary transition-colors font-medium">Baixar App (.apk)</a>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
            <img src={logoImg} alt="Bora Uai" className="h-8 w-8 rounded-lg object-contain shadow-sm" />
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Bora Uai • Sistema completo para bares, restaurantes e baladas</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 6s linear infinite; }
      `}</style>
    </div>
  );
}
