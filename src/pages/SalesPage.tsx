import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Minus, ArrowLeft, Sparkles, Phone, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo/SEO";

type FeatureRow = {
  label: string;
  basic: boolean | string;
  professional: boolean | string;
  premium: boolean | string;
  highlight?: boolean;
};

type FeatureSection = {
  title: string;
  rows: FeatureRow[];
};

const SECTIONS: FeatureSection[] = [
  {
    title: "Cardápio & Pedidos",
    rows: [
      { label: "Cardápio digital online", basic: true, professional: true, premium: true },
      { label: "Produtos cadastrados", basic: "Até 100", professional: "Ilimitado", premium: "Ilimitado", highlight: true },
      { label: "Categorias e modificadores", basic: true, professional: true, premium: true },
      { label: "Pedidos delivery & retirada", basic: true, professional: true, premium: true },
      { label: "Pedidos no salão (Dine-in via QR Code)", basic: false, professional: true, premium: true, highlight: true },
      { label: "Comandas individuais por cliente", basic: false, professional: true, premium: true },
      { label: "Divisão de conta (igual / por item)", basic: false, professional: true, premium: true },
      { label: "Acompanhamento de pedido em tempo real", basic: true, professional: true, premium: true },
    ],
  },
  {
    title: "Operação & Cozinha",
    rows: [
      { label: "PDV / Caixa", basic: true, professional: true, premium: true },
      { label: "Múltiplos caixas simultâneos", basic: false, professional: true, premium: true },
      { label: "KDS (Kitchen Display System)", basic: false, professional: true, premium: true, highlight: true },
      { label: "App Garçom (PWA offline)", basic: false, professional: true, premium: true, highlight: true },
      { label: "Gestão de mesas e chamadas de garçom", basic: false, professional: true, premium: true },
      { label: "Reservas de mesa", basic: true, professional: true, premium: true },
      { label: "Gestão de entregadores", basic: true, professional: true, premium: true },
      { label: "Impressão de comandas térmicas 80mm", basic: true, professional: true, premium: true },
      { label: "Balança digital integrada", basic: false, professional: true, premium: true },
    ],
  },
  {
    title: "Estoque & Insumos",
    rows: [
      { label: "Controle de estoque de insumos", basic: false, professional: true, premium: true, highlight: true },
      { label: "Baixa automática por venda (triggers)", basic: false, professional: true, premium: true },
      { label: "Alertas de estoque mínimo", basic: false, professional: true, premium: true },
      { label: "Ficha técnica de produtos", basic: false, professional: true, premium: true },
    ],
  },
  {
    title: "Marketing & CRM",
    rows: [
      { label: "Cupons de desconto", basic: "Até 5", professional: "Até 20", premium: "Ilimitado" },
      { label: "Cadastro automático de clientes", basic: true, professional: true, premium: true },
      { label: "CRM completo (histórico, ticket médio)", basic: false, professional: false, premium: true, highlight: true },
      { label: "Pesquisa de satisfação automática", basic: true, professional: true, premium: true },
      { label: "Notificações via WhatsApp (wa.me)", basic: true, professional: true, premium: true },
      { label: "Área do cliente autenticada", basic: true, professional: true, premium: true },
    ],
  },
  {
    title: "Financeiro & Relatórios",
    rows: [
      { label: "Dashboard de vendas em tempo real", basic: true, professional: true, premium: true },
      { label: "Controle de despesas e contas a pagar", basic: true, professional: true, premium: true },
      { label: "Relatórios avançados e exportação CSV", basic: false, professional: true, premium: true },
      { label: "AI Insights (análises com IA)", basic: false, professional: false, premium: true, highlight: true },
      { label: "Integridade financeira (cancelados excluídos)", basic: true, professional: true, premium: true },
    ],
  },
  {
    title: "Personalização & Integrações",
    rows: [
      { label: "Site/cardápio público", basic: false, professional: true, premium: true },
      { label: "Cores personalizadas (white-label)", basic: false, professional: true, premium: true },
      { label: "Upload de logo e banner", basic: true, professional: true, premium: true },
      { label: "Notificações via Telegram", basic: true, professional: true, premium: true },
      { label: "API de integração", basic: false, professional: false, premium: true, highlight: true },
      { label: "Domínio personalizado", basic: false, professional: false, premium: true },
    ],
  },
  {
    title: "Suporte",
    rows: [
      { label: "Suporte por e-mail", basic: true, professional: true, premium: true },
      { label: "Suporte prioritário WhatsApp", basic: false, professional: true, premium: true },
      { label: "Onboarding dedicado", basic: false, professional: false, premium: true },
      { label: "Gerente de conta exclusivo", basic: false, professional: false, premium: true },
    ],
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return (
      <div className="flex items-center justify-center">
        <Check className="h-5 w-5 text-primary" strokeWidth={2.5} />
      </div>
    );
  if (value === false)
    return (
      <div className="flex items-center justify-center">
        <Minus className="h-5 w-5 text-muted-foreground/40" />
      </div>
    );
  return (
    <div className="flex items-center justify-center text-sm font-medium text-foreground">
      {value}
    </div>
  );
}

export default function SalesPage() {
  const { data: plans = [] } = useQuery({
    queryKey: ["sales-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("price");
      return data || [];
    },
  });

  const fmt = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  const planByTier = (tier: string) => plans.find((p: any) => p.tier === tier);
  const basic = planByTier("basic");
  const pro = planByTier("professional");
  const premium = planByTier("premium");

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Compare os Planos — Bora Uai"
        description="Compare recursos dos planos Básico, Profissional e Premium do Bora Uai. Cardápio QR, KDS, delivery, comanda, modo balada e IA."
        path="/vendas"
      />
      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para home
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/5500000000000?text=Quero%20conhecer%20os%20planos%20do%20Bora%20Uai"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Falar com vendas
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-muted/30 to-background py-16 md:py-24">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Compare todos os recursos lado a lado
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Escolha o plano ideal para o seu negócio
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Tudo que o Bora Uai oferece, separado por plano. Comece grátis por 14 dias —
            sem cartão de crédito.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/cadastro">
              <Button size="lg" className="w-full sm:w-auto">
                Começar trial de 14 dias
              </Button>
            </Link>
            <a href="#comparativo">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Ver comparativo completo
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="comparativo" className="py-12 md:py-20">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Sticky table header with plan names + prices */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[760px]">
              <thead className="sticky top-14 z-40 bg-card">
                <tr className="border-b border-border">
                  <th className="w-[34%] px-6 py-6 text-left">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Recursos
                    </p>
                    <p className="mt-1 font-heading text-lg font-semibold text-foreground">
                      Tudo do Bora Uai
                    </p>
                  </th>
                  <th className="w-[22%] px-4 py-6 text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Básico
                    </p>
                    <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                      {basic ? fmt(basic.price) : "—"}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <Link to="/cadastro" className="mt-3 inline-block">
                      <Button size="sm" variant="outline" className="w-full">
                        Começar
                      </Button>
                    </Link>
                  </th>
                  <th className="w-[22%] bg-primary/5 px-4 py-6 text-center">
                    <p className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      <Sparkles className="h-3 w-3" />
                      Mais popular
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Profissional
                    </p>
                    <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                      {pro ? fmt(pro.price) : "—"}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <Link to="/cadastro" className="mt-3 inline-block w-full">
                      <Button size="sm" className="w-full">
                        Começar
                      </Button>
                    </Link>
                  </th>
                  <th className="w-[22%] px-4 py-6 text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Premium
                    </p>
                    <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                      {premium ? fmt(premium.price) : "—"}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <Link to="/cadastro" className="mt-3 inline-block">
                      <Button size="sm" variant="outline" className="w-full">
                        Começar
                      </Button>
                    </Link>
                  </th>
                </tr>
              </thead>

              <tbody>
                {SECTIONS.map((section) => (
                  <Fragment key={section.title}>
                    <tr className="bg-muted/40">
                      <td
                        colSpan={4}
                        className="px-6 py-3 font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row, idx) => (
                      <tr
                        key={`${section.title}-${idx}`}
                        className="border-b border-border last:border-b-0 hover:bg-muted/20"
                      >
                        <td className="px-6 py-3.5 text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            {row.label}
                            {row.highlight && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                Destaque
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Cell value={row.basic} />
                        </td>
                        <td className="bg-primary/5 px-4 py-3.5">
                          <Cell value={row.professional} />
                        </td>
                        <td className="px-4 py-3.5">
                          <Cell value={row.premium} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer CTA */}
          <div className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-8 text-center md:p-12">
            <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
              Pronto para começar?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Trial de 14 dias em qualquer plano. Sem cartão de crédito, cancelamento a
              qualquer momento.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/cadastro">
                <Button size="lg" className="w-full sm:w-auto">
                  Começar trial gratuito
                </Button>
              </Link>
              <a
                href="https://wa.me/5500000000000?text=Quero%20conhecer%20os%20planos%20do%20Bora%20Uai"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                  <Phone className="h-4 w-4" />
                  Falar com um consultor
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
