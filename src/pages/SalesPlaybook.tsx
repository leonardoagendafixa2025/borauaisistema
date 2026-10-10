import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Menu, Home, Package, ChefHat, Megaphone, TrendingUp,
  Plug, UtensilsCrossed, Trophy, MessageSquare, Lightbulb, Check,
  ExternalLink, Copy, ChevronRight, Sparkles, Target, Zap, Shield, Truck, Music,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  SECTIONS, PLANS_INFO, SALES_SCRIPTS, COMPETITIVE_ADVANTAGES,
  type ModuleSection, type PlanTier,
} from '@/data/salesPlaybook';

const ICON_MAP: Record<string, any> = {
  UtensilsCrossed, ChefHat, Package, Megaphone, TrendingUp, Plug, Truck, Music,
};

const NAV = [
  { id: 'overview', title: 'Visão geral', icon: Home },
  { id: 'plans', title: 'Planos & Preços', icon: Target },
  ...SECTIONS.map((s) => ({ id: s.id, title: s.title, icon: ICON_MAP[s.icon] || Package })),
  { id: 'competitors', title: 'Vs Concorrentes', icon: Trophy },
  { id: 'scripts', title: 'Scripts de venda', icon: MessageSquare },
  { id: 'objections', title: 'Objeções gerais', icon: Lightbulb },
];

const PLAN_BADGE: Record<PlanTier, { label: string; cls: string }> = {
  basic: { label: 'Básico', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  professional: { label: 'Pro', cls: 'bg-primary/15 text-primary' },
  premium: { label: 'Premium', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
};

function PlanBadge({ tier }: { tier: PlanTier }) {
  const b = PLAN_BADGE[tier];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${b.cls}`}>
      {b.label}
    </span>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Copiado!');
}

function NavList({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <nav className="space-y-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-left">{item.title}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FeatureCard({ feature }: { feature: ModuleSection['features'][0] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-heading text-lg font-bold text-foreground">{feature.name}</h3>
        <div className="flex flex-wrap gap-1">
          {feature.plans.map((p) => <PlanBadge key={p} tier={p} />)}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3" /> O que faz (técnico)
          </p>
          <p className="text-sm text-foreground/90">{feature.what}</p>
        </div>

        <div className="rounded-lg bg-primary/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> Frase de venda
          </p>
          <p className="text-sm italic text-foreground">"{feature.pitch}"</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7 gap-1.5 px-2 text-xs"
            onClick={() => copy(feature.pitch)}
          >
            <Copy className="h-3 w-3" /> Copiar pitch
          </Button>
        </div>

        {feature.objections.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Shield className="h-3 w-3" /> Objeções & respostas
            </p>
            <div className="space-y-2">
              {feature.objections.map((o, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-foreground">❓ {o.q}</p>
                  <p className="mt-1 text-xs text-muted-foreground">→ {o.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {feature.demoUrl && (
          <a href={feature.demoUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Demonstrar agora ({feature.demoUrl})
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default function SalesPlaybook() {
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (id: string) => {
    setActive(id);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentSection = SECTIONS.find((s) => s.id === active);

  return (
    <div className="min-h-screen bg-background">
      {/* Header mobile + desktop */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-3 md:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="border-b border-border p-4">
                  <p className="font-heading text-base font-bold">Playbook do Vendedor</p>
                  <p className="text-xs text-muted-foreground">Bora Uai — uso interno</p>
                </div>
                <NavList active={active} onSelect={handleSelect} />
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              Playbook de vendas — uso interno
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              CONFIDENCIAL
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-muted/20 lg:block">
          <div className="border-b border-border p-4">
            <p className="font-heading text-sm font-bold">Playbook do Vendedor</p>
            <p className="text-xs text-muted-foreground">Bora Uai — uso interno</p>
          </div>
          <NavList active={active} onSelect={handleSelect} />
        </aside>

        {/* Conteúdo */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-10">
          <div className="mx-auto max-w-4xl">
            {/* OVERVIEW */}
            {active === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h1 className="font-heading text-3xl font-bold md:text-4xl">Visão geral</h1>
                  <p className="mt-2 text-muted-foreground">
                    Tudo que você precisa para vender o Bora Uai com segurança e fechar mais clientes.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <Target className="mb-3 h-6 w-6 text-primary" />
                    <h3 className="font-heading font-bold">O que é o Bora Uai</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Plataforma SaaS completa de gestão para restaurantes: cardápio digital, pedidos
                      delivery/salão/QR Code, KDS, estoque, CRM, app garçom, financeiro, IA. Substitui
                      iFood + sistema de PDV + planilhas.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-5">
                    <Zap className="mb-3 h-6 w-6 text-primary" />
                    <h3 className="font-heading font-bold">Diferencial principal</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Mensalidade fixa (sem % por venda). Cliente fica com 100% do faturamento.
                      Em 1 mês paga sozinho substituindo as taxas do iFood.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-heading font-bold">Perfil do cliente ideal (ICP)</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {[
                      'Restaurante com mínimo 30 pedidos/dia',
                      'Já vende online (mesmo que via WhatsApp/iFood)',
                      'Dono envolvido na operação (não absenteísta)',
                      'Insatisfeito com taxa de marketplace OU com falta de controle',
                      'Estabelecimento próprio (não fast-food de shopping)',
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <h3 className="font-heading font-bold text-amber-900 dark:text-amber-200">
                    💡 Como usar este playbook
                  </h3>
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-900/80 dark:text-amber-100/80">
                    <li>Estude a seção <strong>Planos & Preços</strong> primeiro.</li>
                    <li>Leia cada módulo para conhecer as funcionalidades.</li>
                    <li>Decore os <strong>Scripts</strong> e treine as <strong>Objeções</strong>.</li>
                    <li>Use o botão "Demonstrar agora" para mostrar features ao vivo.</li>
                    <li>Copie pitches direto pra mensagem com o botão "Copiar pitch".</li>
                  </ol>
                </div>
              </div>
            )}

            {/* PLANOS */}
            {active === 'plans' && (
              <div className="space-y-8">
                <div>
                  <h1 className="font-heading text-3xl font-bold md:text-4xl">Planos & Preços</h1>
                  <p className="mt-2 text-muted-foreground">
                    Quem é o cliente certo para cada plano. Sempre comece sugerindo o Profissional.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {(Object.keys(PLANS_INFO) as PlanTier[]).map((tier) => {
                    const p = PLANS_INFO[tier];
                    const featured = tier === 'professional';
                    return (
                      <div
                        key={tier}
                        className={`rounded-xl border-2 p-5 ${
                          featured ? 'border-primary bg-primary/5' : 'border-border bg-card'
                        }`}
                      >
                        {featured && (
                          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                            <Sparkles className="h-3 w-3" /> Sweet spot
                          </span>
                        )}
                        <h3 className="font-heading text-xl font-bold">{p.name}</h3>
                        <p className="mt-1 font-heading text-3xl font-bold text-foreground">
                          R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </p>
                        <div className="mt-4 space-y-3 text-sm">
                          <div>
                            <p className="text-[11px] font-bold uppercase text-muted-foreground">Para quem</p>
                            <p className="mt-1">{p.target}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase text-muted-foreground">Sweet spot</p>
                            <p className="mt-1">{p.sweetSpot}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-heading font-bold">Estratégia de upsell</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li>👉 <strong>Sempre ofereça o Profissional primeiro.</strong> É o mais vendido e tem maior valor percebido.</li>
                    <li>👉 <strong>Básico só se o cliente travar no preço</strong> ou for muito pequeno (food truck, sem salão).</li>
                    <li>👉 <strong>Premium se mencionar:</strong> múltiplas unidades, alto volume, ERP próprio, análises de IA.</li>
                    <li>👉 <strong>14 dias grátis em qualquer plano</strong> — use isso pra quebrar objeção.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* MÓDULO */}
            {currentSection && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-heading text-3xl font-bold md:text-4xl">{currentSection.title}</h1>
                  <p className="mt-2 text-muted-foreground">{currentSection.description}</p>
                </div>
                <div className="space-y-4">
                  {currentSection.features.map((f) => (
                    <FeatureCard key={f.name} feature={f} />
                  ))}
                </div>
              </div>
            )}

            {/* COMPETIDORES */}
            {active === 'competitors' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-heading text-3xl font-bold md:text-4xl">Vs Concorrentes</h1>
                  <p className="mt-2 text-muted-foreground">
                    Como nos posicionamos contra cada alternativa do cliente.
                  </p>
                </div>
                <div className="space-y-3">
                  {COMPETITIVE_ADVANTAGES.map((c) => (
                    <div key={c.vs} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-muted px-3 py-1 font-heading text-sm font-bold">
                          Bora Uai vs {c.vs}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-3 text-sm text-foreground">{c.advantage}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCRIPTS */}
            {active === 'scripts' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-heading text-3xl font-bold md:text-4xl">Scripts de venda</h1>
                  <p className="mt-2 text-muted-foreground">
                    Use como ponto de partida. Adapte ao tom da conversa.
                  </p>
                </div>

                {[
                  { title: '1. Abertura (cold call / WhatsApp)', text: SALES_SCRIPTS.abertura },
                  { title: '4. Objeção: "está caro"', text: SALES_SCRIPTS.objecaoPreco },
                  { title: '5. Objeção: "vou pensar"', text: SALES_SCRIPTS.objecaoTempo },
                  { title: '6. Fechamento', text: SALES_SCRIPTS.fechamento },
                  { title: '7. Sugestão de Resposta (WhatsApp)', text: (SALES_SCRIPTS as any).zapVendas || '' },
                ].map((s) => (
                  <div key={s.title} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-heading font-bold">{s.title}</h3>
                      <Button size="sm" variant="outline" onClick={() => copy(s.text)} className="gap-1.5">
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                      {s.text}
                    </p>
                  </div>
                ))}

                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-heading font-bold">2-3. Perguntas de qualificação</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Faça pelo menos 3 dessas antes de propor um plano:
                  </p>
                  <ul className="mt-3 space-y-2">
                    {SALES_SCRIPTS.qualificacao.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="font-bold text-primary">{i + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* OBJEÇÕES GERAIS */}
            {active === 'objections' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-heading text-3xl font-bold md:text-4xl">Objeções gerais</h1>
                  <p className="mt-2 text-muted-foreground">
                    As mais comuns na primeira conversa. Decore as respostas.
                  </p>
                </div>

                {[
                  { q: '"Está caro"', a: 'Compare com a taxa do iFood. Cliente que faz 100 pedidos/mês a R$50 paga R$1.500 só de taxa. Aqui são R$199-799 fixos. ROI em 1 semana.' },
                  { q: '"Já tenho um sistema"', a: 'Pergunte: "Funciona em tempo real? Tem app pro garçom? Controla estoque com baixa automática?". 90% dos sistemas são só PDV antigo.' },
                  { q: '"Não tenho tempo pra aprender"', a: 'Onboarding em 1 hora. A gente cadastra os primeiros produtos junto. E é mais fácil que WhatsApp Business.' },
                  { q: '"Preciso conversar com meu sócio"', a: '"Claro. Posso te mandar um resumo em PDF que você compartilha? E agendar uma call de 15min com vocês dois pra tirar dúvidas?". Não solte sem próximo passo agendado.' },
                  { q: '"Vou pensar"', a: '"Entendo. O que ainda não te deixou seguro?". Se for preço → trial 14 dias. Se for tempo → onboarding assistido. Se for "não confio" → mostra cases.' },
                  { q: '"Meus clientes não sabem usar"', a: 'O cardápio é mais fácil que iFood. E quem já usou iFood, aprende em 2 segundos. Idoso também usa — interface grande, fontes legíveis.' },
                  { q: '"E se eu cancelar?"', a: 'Cancela quando quiser, sem multa. Você exporta seus dados (clientes, pedidos, produtos) em CSV. Sem prisão.' },
                ].map((o, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-5">
                    <p className="font-heading font-bold text-foreground">❓ {o.q}</p>
                    <p className="mt-3 rounded-lg bg-primary/5 p-3 text-sm text-foreground">
                      <strong className="text-primary">→ Resposta:</strong> {o.a}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
