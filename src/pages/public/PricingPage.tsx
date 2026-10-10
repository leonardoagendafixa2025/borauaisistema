import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ArrowLeft, Sparkles, Crown, Rocket, Minus, Star } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SEO } from '@/components/seo/SEO';
import logoImg from '@/assets/logo.png';

const TIER_META: Record<string, { icon: any; gradient: string; label?: string }> = {
  basic: { icon: Rocket, gradient: 'from-slate-500 to-slate-700' },
  professional: { icon: Sparkles, gradient: 'from-[#FF5757] to-[#FF8A65]', label: 'MAIS POPULAR' },
  premium: { icon: Crown, gradient: 'from-purple-600 to-pink-600', label: 'COMPLETO' },
};

export default function PricingPage() {
  const faqs = [
    { q: 'Tem fidelidade?', a: 'Não. É mensal e você cancela quando quiser, direto pelo painel.' },
    { q: 'Cobra taxa por pedido?', a: 'Não. Pagou a mensalidade, faz pedidos ilimitados. Você fica com 100% das vendas.' },
    { q: 'Como funcionam os 14 dias grátis?', a: 'Cadastra sem cartão, usa tudo do plano Profissional por 14 dias. Depois escolhe o plano.' },
    { q: 'E se eu quiser trocar de plano?', a: 'Pode subir ou descer plano a qualquer momento. O valor é ajustado proporcionalmente.' },
    { q: 'Funciona no celular?', a: 'Sim. Painel responsivo + apps PWA do garçom e cozinha. Instala como app no celular.' },
    { q: 'Aceita PIX, cartão, dinheiro?', a: 'Sim. O sistema apenas registra a forma de pagamento. Você recebe direto do cliente, sem intermediário.' },
  ];
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };


  // Fallback estático: garante que a página nunca fica vazia se o banco estiver lento/fora.
  const FALLBACK_PLANS = [
    {
      id: 'fallback-basic', name: 'Básico', tier: 'basic', price: 69.99,
      description: 'Comece pequeno: PDV, cardápio digital e delivery próprio.',
      features: ['PDV + caixa', 'Cardápio digital QR', 'Delivery & retirada', 'Cupons (até 5)', '2 usuários', 'Suporte por e-mail'],
    },
    {
      id: 'fallback-pro', name: 'Profissional', tier: 'professional', price: 119.99,
      description: 'O queridinho dos bares: comandas, KDS, garçom e modo balada.',
      features: ['Tudo do Básico', 'QR Code na mesa', 'KDS (cozinha)', 'Garçom PWA offline', 'Comandas individuais', 'Modo Balada + DJ', 'Estoque', '5 usuários', 'Suporte prioritário'],
    },
    {
      id: 'fallback-premium', name: 'Premium', tier: 'premium', price: 199.99,
      description: 'Operação completa: IA, bot Telegram, domínio e suporte 24/7.',
      features: ['Tudo do Profissional', 'IA Insights', 'Bot Telegram inteligente', 'Domínio personalizado', 'Usuários ilimitados', 'Cupons ilimitados', 'Suporte 24/7'],
    },
  ];

  const { data: plansRaw } = useQuery({
    queryKey: ['public-plans-page'],
    queryFn: async () => {
      const { data, error } = await (publicSupabase
        .from('subscription_plans' as any)
        .select('*')
        .eq('active', true)
        .neq('tier', 'basic_test')
        .order('price') as any);
      if (error) throw error;
      return ((data as any[]) || []).filter((p: any) => p.tier !== 'basic' || p.price >= 50);
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Sempre temos planos para exibir: banco > fallback estático
  const plans = (plansRaw && plansRaw.length > 0) ? plansRaw : FALLBACK_PLANS;

  const fmt = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <SEO
        title="Preços e Planos — Bora Uai | A partir de R$ 69,99/mês"
        description="Planos a partir de R$ 69,99/mês. Teste 14 dias grátis sem cartão. Cardápio QR, KDS, comanda eletrônica, delivery, modo balada. Sem taxa por pedido."
        path="/precos"
        jsonLd={faqJsonLd}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Bora Uai" className="h-8 w-8 rounded-lg" />
            <span className="font-heading font-bold text-lg">Bora Uai</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <Link to="/ajuda" className="hidden sm:inline text-muted-foreground hover:text-foreground">Ajuda</Link>
            
            <Button asChild size="sm" className="bg-[#FF5757] hover:bg-[#FF5757]/90">
              <Link to="/cadastro">Testar 14 dias grátis</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-12 pb-8 text-center max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <Badge className="mb-4 bg-[#FF5757]/10 text-[#FF5757] border-[#FF5757]/20">14 dias grátis · sem cartão</Badge>
        <h1 className="font-heading text-4xl md:text-5xl font-extrabold mb-4">
          Escolha o plano do seu bar, restaurante ou balada
        </h1>
        <p className="text-lg text-muted-foreground">
          Sem taxa por pedido. Sem fidelidade. Cancele quando quiser.
        </p>
      </section>

      {/* Plans grid */}
      <section className="px-4 pb-16 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan: any) => {
            const meta = TIER_META[plan.tier] || TIER_META.basic;
            const Icon = meta.icon;
            const isPopular = plan.tier === 'professional';
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 bg-card transition-all hover:scale-[1.02] ${
                  isPopular ? 'border-[#FF5757] shadow-2xl shadow-[#FF5757]/20' : 'border-border'
                }`}
              >
                {meta.label && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${meta.gradient}`}>
                    {meta.label}
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-heading text-2xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{plan.description}</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">{fmt(plan.price)}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                </div>
                <Button
                  asChild
                  className={`w-full mb-6 ${isPopular ? 'bg-[#FF5757] hover:bg-[#FF5757]/90' : ''}`}
                  variant={isPopular ? 'default' : 'outline'}
                >
                  <Link to="/cadastro">Começar 14 dias grátis</Link>
                </Button>
                <ul className="space-y-2.5 text-sm">
                  {(plan.features || []).map((f: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <Check className="w-4 h-4 text-[#FF5757] mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="mt-20">
          <div className="text-center mb-8">
            <Badge className="mb-3 bg-[#FF5757]/10 text-[#FF5757] hover:bg-[#FF5757]/10 border-0">Comparativo completo</Badge>
            <h2 className="font-heading text-3xl md:text-4xl font-extrabold tracking-tight">
              Tudo que vem em cada plano
            </h2>
            <p className="text-muted-foreground mt-2">Sem letras miúdas. Veja exatamente o que você leva.</p>
          </div>

          <div className="rounded-3xl border bg-card shadow-xl shadow-black/5 overflow-hidden">
            {/* Header com planos */}
            <div className="grid grid-cols-[1.4fr_1fr_1.2fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr] bg-gradient-to-br from-muted/60 to-muted/20 border-b">
              <div className="p-4 md:p-6 flex items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recursos</span>
              </div>
              {[
                { name: 'Básico', icon: Rocket, color: 'text-slate-600', bg: '' },
                { name: 'Profissional', icon: Sparkles, color: 'text-[#FF5757]', bg: 'bg-gradient-to-b from-[#FF5757]/10 to-transparent', popular: true },
                { name: 'Premium', icon: Crown, color: 'text-purple-600', bg: '' },
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.name} className={`p-4 md:p-6 text-center relative ${p.bg}`}>
                    {p.popular && (
                      <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-[#FF5757] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-b-md flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-white" /> POPULAR
                      </div>
                    )}
                    <Icon className={`w-5 h-5 md:w-6 md:h-6 mx-auto mb-1.5 ${p.color}`} />
                    <div className={`font-heading font-bold text-sm md:text-base ${p.color}`}>{p.name}</div>
                  </div>
                );
              })}
            </div>

            {/* Linhas */}
            <div className="divide-y">
              {[
                ['PDV + caixa', true, true, true],
                ['Cardápio digital', true, true, true],
                ['Delivery & retirada', true, true, true],
                ['QR Code na mesa', false, true, true],
                ['KDS (cozinha)', false, true, true],
                ['Garçom PWA offline', false, true, true],
                ['Comandas individuais', false, true, true],
                ['Modo Balada', false, true, true],
                ['Controle de estoque', false, true, true],
                ['Bot Telegram inteligente', false, false, true],
                ['IA Insights', false, false, true],
                ['Domínio personalizado', false, false, true],
                ['Usuários', '2', '5', 'Ilimitados'],
                ['Cupons', '5', '20', 'Ilimitados'],
                ['Suporte', 'E-mail', 'Prioritário', '24/7'],
              ].map((row, i) => {
                const renderCell = (v: any, highlight = false) => {
                  if (v === true) return <Check className={`w-5 h-5 mx-auto ${highlight ? 'text-[#FF5757]' : 'text-emerald-500'}`} strokeWidth={3} />;
                  if (v === false) return <Minus className="w-4 h-4 mx-auto text-muted-foreground/40" />;
                  return <span className={`text-sm font-semibold ${highlight ? 'text-[#FF5757]' : ''}`}>{v}</span>;
                };
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[1.4fr_1fr_1.2fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr] items-center hover:bg-muted/30 transition-colors"
                  >
                    <div className="p-3 md:p-4 text-sm font-medium">{row[0]}</div>
                    <div className="p-3 md:p-4 text-center">{renderCell(row[1])}</div>
                    <div className="p-3 md:p-4 text-center bg-[#FF5757]/[0.04] border-x border-[#FF5757]/10">{renderCell(row[2], true)}</div>
                    <div className="p-3 md:p-4 text-center">{renderCell(row[3])}</div>
                  </div>
                );
              })}
            </div>

            {/* Footer CTA da tabela */}
            <div className="grid grid-cols-[1.4fr_1fr_1.2fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr] bg-muted/30 border-t">
              <div className="hidden md:block p-4" />
              <div className="p-3 md:p-4" />
              <div className="p-3 md:p-4 bg-[#FF5757]/[0.04] border-x border-[#FF5757]/10 flex justify-center">
                <Button asChild size="sm" className="bg-[#FF5757] hover:bg-[#FF5757]/90 text-white font-bold text-xs">
                  <Link to="/cadastro">Começar grátis</Link>
                </Button>
              </div>
              <div className="p-3 md:p-4" />
              <div className="md:hidden p-3" />
            </div>
          </div>
        </div>


        {/* FAQ resumo */}
        <div className="mt-16 grid md:grid-cols-2 gap-6">
          {[
            { q: 'Tem fidelidade?', a: 'Não. É mensal e você cancela quando quiser, direto pelo painel.' },
            { q: 'Cobra taxa por pedido?', a: 'Não. Pagou a mensalidade, faz pedidos ilimitados. Você fica com 100% das vendas.' },
            { q: 'Como funcionam os 14 dias grátis?', a: 'Cadastra sem cartão, usa tudo do plano Profissional por 14 dias. Depois escolhe o plano.' },
            { q: 'E se eu quiser trocar de plano?', a: 'Pode subir ou descer plano a qualquer momento. O valor é ajustado proporcionalmente.' },
            { q: 'Funciona no celular?', a: 'Sim. Painel responsivo + apps PWA do garçom e cozinha. Instala como app no celular.' },
            { q: 'Aceita PIX, cartão, dinheiro?', a: 'Sim. O sistema apenas registra a forma de pagamento. Você recebe direto do cliente, sem intermediário.' },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border p-5 bg-card">
              <h3 className="font-bold mb-2">{f.q}</h3>
              <p className="text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-3xl bg-gradient-to-br from-[#FF5757] to-[#FF8A65] p-10 text-center text-white">
          <h2 className="font-heading text-3xl md:text-4xl font-extrabold mb-3">Bora vender mais hoje?</h2>
          <p className="text-white/90 mb-6 max-w-xl mx-auto">
            Crie sua conta, configure seu cardápio e comece a receber pedidos em 10 minutos.
          </p>
          <Button asChild size="lg" variant="secondary" className="font-bold">
            <Link to="/cadastro">Começar 14 dias grátis</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="flex justify-center gap-4">
          <Link to="/legal/termos" className="hover:text-foreground">Termos</Link>
          <Link to="/legal/privacidade" className="hover:text-foreground">Privacidade</Link>
          <Link to="/ajuda" className="hover:text-foreground">Ajuda</Link>
          
        </div>
      </footer>
    </div>
  );
}
