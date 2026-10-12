import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Search, MessageCircle, BookOpen, Video, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SEO } from '@/components/seo/SEO';
import logoImg from '@/assets/logo.png';

const FAQ_CATEGORIES = [
  {
    name: '🚀 Primeiros passos',
    items: [
      { q: 'Como faço meu cadastro?', a: 'Acesse /cadastro, preencha os dados do seu estabelecimento, crie sua senha e pronto. Você ganha 14 dias grátis no plano Profissional sem precisar de cartão.' },
      { q: 'Como cadastro meus produtos?', a: 'No painel admin, vá em "Cardápio" → "Novo produto". Preencha nome, preço, categoria e foto. Você pode criar variações (P/M/G), adicionais e modificadores.' },
      { q: 'Como gero o QR Code das mesas?', a: 'Vá em "Mesas" no painel, clique em "Nova mesa" e o QR é gerado automaticamente. Imprima e cole na mesa — o cliente escaneia, vê o cardápio e pede direto.' },
      { q: 'Quanto tempo leva pra começar a vender?', a: 'Com cardápio simples (até 30 produtos), em torno de 30 minutos você está vendendo. Cadastros maiores levam 1-2h.' },
    ],
  },
  {
    name: '📱 Cardápio e pedidos',
    items: [
      { q: 'Como meus clientes pedem?', a: 'Eles escaneiam o QR Code da mesa OU acessam seu link público (borauai.com/seu-bar). Escolhem produtos, finalizam pedido e o garçom/cozinha já recebe na hora.' },
      { q: 'O cliente paga online?', a: 'Não. O sistema apenas registra a forma de pagamento (PIX, cartão, dinheiro). O cliente paga direto a você no balcão ou via maquininha. Sem intermediário, sem taxa.' },
      { q: 'Como funciona a comanda individual?', a: 'No modo Dine-in, cada cliente da mesa pode abrir sua comanda. Na hora de fechar, dá pra dividir por pessoa, por item ou igualmente.' },
      { q: 'Posso vender por delivery?', a: 'Sim. O cliente acessa seu link público, escolhe entrega, informa endereço e CEP. Você pode definir taxas por bairro e raio máximo.' },
    ],
  },
  {
    name: '👨‍🍳 Cozinha e operação',
    items: [
      { q: 'Como funciona o KDS (tela da cozinha)?', a: 'Pedidos entram em tempo real numa tela touch. Cozinheiro toca para mover de "Novo" → "Preparando" → "Pronto". Som configurável e modo TV em tela cheia.' },
      { q: 'Imprime ticket pra cozinha?', a: 'Sim, em impressoras térmicas 80mm. Configure em "Configurações" → "Impressão". Bebidas pulam a cozinha e vão direto pro caixa.' },
      { q: 'Como uso o app do garçom?', a: 'Seu garçom acessa /garcom no celular, faz login com PIN, e usa offline. Quando volta o sinal, sincroniza tudo automaticamente.' },
    ],
  },
  {
    name: '💰 Cobrança e planos',
    items: [
      { q: 'Como pago a mensalidade?', a: 'Cartão de crédito recorrente via Stripe (checkout seguro). Sem precisar lembrar de pagar — renovação automática mensal.' },
      { q: 'Posso cancelar quando quiser?', a: 'Sim. Sem multa, sem fidelidade. No painel, vá em "Assinatura" → "Cancelar". Você continua usando até o fim do mês pago.' },
      { q: 'Posso trocar de plano?', a: 'Sim, a qualquer momento. Subindo de plano, libera na hora. Descendo, vale a partir do próximo ciclo.' },
      { q: 'O que acontece se eu não pagar?', a: 'Você tem 5 dias de tolerância. Após isso, a conta é suspensa (pedidos param) até regularizar. Seus dados ficam guardados por 90 dias.' },
    ],
  },
  {
    name: '🎉 Modo Balada',
    items: [
      { q: 'O que é o Modo Balada?', a: 'Sistema otimizado pra casa noturna: venda avulsa em 3 toques, pedidos de música pelo cliente, ranking ao vivo de garçons, comissão automática.' },
      { q: 'Como funciona o pedido de música?', a: 'O cliente escaneia o QR, pesquisa a música e envia pro DJ. O DJ aprova/rejeita no painel. Você pode cobrar pela música.' },
      { q: 'Tem painel ao vivo pro telão?', a: 'Sim. /seu-bar/balada mostra line-up, drink da hora, próximas atrações. Pode jogar na TV da casa.' },
    ],
  },
  {
    name: '🤖 Telegram e IA',
    items: [
      { q: 'Como conecto o Telegram?', a: 'No painel, no banner do dashboard, clique em "Conectar Telegram". Vai abrir nosso bot — clique em /start e pronto. Você passa a receber pedidos, alertas e relatórios direto no chat.' },
      { q: 'Quais comandos existem no bot?', a: '/relatorio (vendas do dia), /comandas (mesas abertas), /abrir e /fechar (operação), /promover (broadcast pros clientes). Plano Premium libera todos.' },
      { q: 'O que é a IA Insights?', a: 'Disponível no Premium. Analisa suas vendas e dá sugestões: produtos pra promover, horários de pico, clientes inativos pra reativar.' },
    ],
  },
];

export default function HelpCenter() {
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = 'Central de Ajuda — Bora Uai';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Tire suas dúvidas sobre o Bora Uai. Tutoriais, FAQ e suporte para bares, restaurantes e baladas.');
  }, []);

  const filtered = FAQ_CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(i =>
      !search ||
      i.q.toLowerCase().includes(search.toLowerCase()) ||
      i.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(c => c.items.length > 0);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_CATEGORIES.flatMap((c) => c.items).map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <SEO
        title="Central de Ajuda — Bora Uai | FAQ e Suporte"
        description="Tire suas dúvidas sobre cadastro, QR Code de mesa, cardápio, KDS, delivery e modo balada. FAQ completo e suporte para bares e restaurantes."
        path="/ajuda"
        jsonLd={faqJsonLd}
      />
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Bora Uai" className="h-8 w-8 rounded-lg" />
            <span className="font-heading font-bold text-lg">Bora Uai</span>
          </Link>
          <Button asChild size="sm" className="bg-[#FF5757] hover:bg-[#FF5757]/90">
            <Link to="/cadastro">Testar grátis</Link>
          </Button>
        </div>
      </header>

      <section className="px-4 py-12 max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold mb-3">Como podemos ajudar?</h1>
          <p className="text-lg text-muted-foreground">Respostas rápidas, tutoriais e suporte.</p>
        </div>

        <div className="relative max-w-xl mx-auto mb-12">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Pesquise sua dúvida..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-12">
          {[
            { icon: BookOpen, label: 'Guia de início', href: '#primeiros' },
            { icon: Video, label: 'Vídeos tutoriais', href: '#videos' },
            { icon: MessageCircle, label: 'WhatsApp suporte', href: 'https://wa.me/5531975385879', external: true },
          ].map((link, i) => {
            const Icon = link.icon;
            const Tag: any = link.external ? 'a' : Link;
            const props = link.external ? { href: link.href, target: '_blank', rel: 'noopener' } : { to: link.href };
            return (
              <Tag key={i} {...props} className="rounded-xl border p-4 bg-card hover:border-[#FF5757] transition-colors flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#FF5757]/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#FF5757]" />
                </div>
                <span className="font-semibold text-sm">{link.label}</span>
              </Tag>
            );
          })}
        </div>

        {/* Vídeos placeholder */}
        <div id="videos" className="mb-12">
          <h2 className="font-heading text-2xl font-bold mb-4">🎥 Vídeos tutoriais</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Configurando seu cardápio',
              'Como gerar QR Code da mesa',
              'Operando a cozinha (KDS)',
              'Recebendo pedidos no Telegram',
            ].map((title, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#FF5757] to-[#FF8A65] flex items-center justify-center">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground">Em breve</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div id="primeiros" className="space-y-6">
          {filtered.map((cat, i) => (
            <div key={i} className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b bg-muted/30">
                <h2 className="font-heading text-xl font-bold">{cat.name}</h2>
              </div>
              <div className="px-6">
                <Accordion type="single" collapsible>
                  {cat.items.map((item, j) => (
                    <AccordionItem key={j} value={`${i}-${j}`}>
                      <AccordionTrigger className="text-left font-semibold">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum resultado para "{search}". Fala com a gente no WhatsApp!
            </div>
          )}
        </div>

        {/* Contato */}
        <div className="mt-16 rounded-2xl bg-gradient-to-br from-[#FF5757] to-[#FF8A65] p-8 text-white text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Não achou o que procura?</h2>
          <p className="mb-6 text-white/90">Nossa equipe responde rapidinho.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="secondary">
              <a href="https://wa.me/5531975385879" target="_blank" rel="noopener">
                <Phone className="w-4 h-4 mr-2" /> WhatsApp
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="mailto:toyesterdayagencia@gmail.com">
                <Mail className="w-4 h-4 mr-2" /> E-mail
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
