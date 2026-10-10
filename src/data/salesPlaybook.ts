// Conteúdo do playbook de vendas - separado para manutenção fácil
export type PlanTier = 'basic' | 'professional' | 'premium';

export interface FeatureItem {
  name: string;
  what: string; // O que faz (técnico)
  pitch: string; // Frase de venda
  objections: { q: string; a: string }[];
  demoUrl?: string;
  plans: PlanTier[];
}

export interface ModuleSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  features: FeatureItem[];
}

export const PLANS_INFO = {
  basic: {
    name: 'Básico',
    price: 69.99,
    target: 'Lanchonetes pequenas, food trucks, delivery iniciante',
    sweetSpot: 'Estabelecimento com até 100 itens no cardápio, sem salão',
    color: 'bg-slate-500',
  },
  professional: {
    name: 'Profissional',
    price: 119.99,
    target: 'Restaurantes com salão + delivery, pizzarias, hamburguerias estabelecidas',
    sweetSpot: 'Já tem salão e delivery, precisa profissionalizar a operação',
    color: 'bg-primary',
  },
  premium: {
    name: 'Premium',
    price: 199.99,
    target: 'Redes, restaurantes médios/grandes, operações multi-unidade',
    sweetSpot: 'Faturamento >R$80k/mês, precisa de CRM, IA e API',
  },
};

export const SECTIONS: ModuleSection[] = [
  {
    id: 'cardapio',
    title: 'Cardápio & Pedidos',
    icon: 'UtensilsCrossed',
    description: 'O coração da operação: como o cliente faz pedidos.',
    features: [
      {
        name: 'Cardápio digital online',
        what: 'Cardápio responsivo acessível por link único (boraUai.com/restaurante). Categorias, fotos, preços, modificadores, promoções, esgotado em tempo real.',
        pitch: 'Seu cliente vê o cardápio atualizado no celular sem precisar baixar app. Você muda preço de manhã, já reflete no almoço.',
        objections: [
          { q: 'Já tenho iFood', a: 'iFood cobra 12-30% por pedido. Aqui você paga mensalidade fixa e fica com 100% da venda. Em 30 pedidos/mês já se paga.' },
          { q: 'Cliente não vai entrar no link', a: 'QR Code na mesa, link no Instagram, no Google Meu Negócio. Quem pediu uma vez, salva no celular.' },
        ],
        demoUrl: '/boteco-do-ze',
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Comandas individuais (Dine-in)',
        what: 'Cada pessoa na mesa abre sua própria comanda via QR Code. Pedidos vinculados ao nome da pessoa (order_items.command_id), integra com pagamento parcial e divisão de conta.',
        pitch: 'Mesa de 6 amigos, cada um pede no próprio celular. Na hora de pagar, cada um vê só o que consumiu. Acabou confusão de "quem pediu o quê".',
        objections: [
          { q: 'Garçom já anota tudo', a: 'Reduz tempo do garçom, aumenta giro de mesa em 20-30%. Cliente pede mais quando não precisa esperar atendimento.' },
        ],
        demoUrl: '/boteco-do-ze/mesa/1',
        plans: ['professional', 'premium'],
      },
      {
        name: 'Divisão de conta',
        what: 'Modo Igual (divide total por N pessoas) ou Modo Itens (cada um seleciona o que consumiu). Gera link WhatsApp com cobrança individual.',
        pitch: 'Aquele momento chato de dividir conta acabou. O sistema faz, manda por WhatsApp, e cada cliente paga sua parte no Pix.',
        objections: [
          { q: 'Garçom faz na calculadora', a: 'Erro humano, demora, cliente fica insatisfeito. Aqui é instantâneo e sem erro.' },
        ],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Cardápio em árvore com subcategorias',
        what: 'Categorias com subcategorias (parent_id) para organizar cardápios grandes. Ex: Bebidas → Cervejas → Long Neck. Barra flutuante para ações em massa: ativar/desativar, mover, esgotar vários produtos de uma vez.',
        pitch: 'Cardápio com 200 itens vira navegável em 3 cliques. Acabou bagunça. E quando acabar o estoque de uma marca de cerveja inteira, esgota tudo de uma vez sem precisar abrir item por item.',
        objections: [
          { q: 'Meu cardápio é pequeno', a: 'Beleza, então usa só categorias normais. Mas quando crescer, já tá pronto.' },
        ],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Modificadores e opcionais',
        what: 'Grupos de seleção (ex: ponto da carne, adicionais) com mín/máx obrigatórios e preços dinâmicos.',
        pitch: 'Cliente monta o pedido do jeito dele. Hambúrguer com bacon extra? +R$5 automático. Sem dor de cabeça pra cozinha.',
        objections: [
          { q: 'Muito complicado de configurar', a: 'Configura uma vez, usa pra sempre. E a gente ajuda no onboarding.' },
        ],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Banners promocionais',
        what: 'Banners rotativos no topo do cardápio público com agendamento (data início/fim), link interno e ordem de exibição.',
        pitch: 'Promoção da semana? Combo do dia? Banner aparece no topo do cardápio, agendado pra entrar e sair sozinho. Igual marketing de e-commerce, sem custo extra.',
        objections: [],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Combos e kits promocionais',
        what: 'Monta combos com preço fechado (ex: Hambúrguer + batata + refri por R$ 39). Aparecem em destaque no cardápio, com badge de economia.',
        pitch: 'Aumenta ticket médio em 20-40%. Cliente que ia pedir só o lanche leva o combo porque "vale mais a pena". Igual McDonald\'s.',
        objections: [
          { q: 'Vou perder margem', a: 'Ao contrário: você empurra itens de alta margem (bebida, batata) junto com o carro-chefe. Ganha em volume.' },
        ],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Pagamento parcial de comanda',
        what: 'Cliente pode pagar parte da conta (R$ 50 dos R$ 130) e deixar a mesa aberta. Sistema registra o pago, mantém saldo devedor e permite fechamento posterior.',
        pitch: 'Mesa longa, um amigo precisa ir embora antes. Paga a parte dele, o resto continua. Sem ficar "esperando fechar" ninguém.',
        objections: [],
        plans: ['professional', 'premium'],
      },
    ],
  },
  {
    id: 'operacao',
    title: 'Operação & Cozinha',
    icon: 'ChefHat',
    description: 'Como a equipe trabalha o dia a dia.',
    features: [
      {
        name: 'KDS (Kitchen Display System)',
        what: 'Tela de TV/tablet na cozinha mostra pedidos em tempo real, organizados por status (novo, preparando, pronto). Sem papel.',
        pitch: 'Acabou comanda perdida, letra ilegível, pedido esquecido. A cozinha vê tudo numa tela grande, organizado por horário.',
        objections: [
          { q: 'Não tenho TV na cozinha', a: 'Funciona em qualquer tablet Android de R$500. Custo mínimo, ganho enorme.' },
          { q: 'Cozinheiro não sabe usar', a: 'Tela touch enorme, só toca quando o pedido fica pronto. Mais simples que WhatsApp.' },
        ],
        plans: ['professional', 'premium'],
      },
      {
        name: 'App Garçom (PWA offline)',
        what: 'App instalável no celular do garçom, funciona offline. Anota pedido na mesa, sincroniza quando voltar wi-fi.',
        pitch: 'Garçom anota pedido direto no celular dele. Sem caderninho, sem precisar voltar pra cozinha. Funciona até no subsolo sem sinal.',
        objections: [
          { q: 'Garçom não tem celular bom', a: 'Funciona em qualquer Android. E aumenta a gorjeta dele em 15-20% pela agilidade.' },
        ],
        demoUrl: '/garcom',
        plans: ['professional', 'premium'],
      },
      {
        name: '⚡ Modo Balada (venda avulsa mobile)',
        what: 'Garçom vende em 3 toques no celular no meio da galera: grid de produtos favoritos, cobrança instantânea (PIX/cartão/dinheiro), funciona offline. Dashboard ao vivo com ranking por garçom, comissão automática (% configurável) e gráfico de pulso de vendas a cada 30min.',
        pitch: 'Boate, balada, festival, evento. Cliente em pé, garçom anda com celular vendendo cerveja. 3 toques: produto → pagamento → próxima venda. Ninguém para na fila. No fim da noite, ranking mostra quem vendeu mais e a comissão já cai calculada.',
        objections: [
          { q: 'Meu garçom não tem celular bom', a: 'Funciona em qualquer Android. E como aumenta a venda dele em 30-50% pela velocidade, a comissão paga o aparelho em uma noite.' },
          { q: 'E se cair a internet no meio da festa?', a: 'Funciona 100% offline. Salva tudo no celular e sincroniza quando voltar a conexão. Você nunca perde uma venda.' },
          { q: 'Como controlo dinheiro do garçom?', a: 'Cada venda fica registrada com nome do garçom, forma de pagamento e horário. Fechamento por garçom no fim da noite, com comissão já calculada.' },
        ],
        demoUrl: '/garcom/balada',
        plans: ['professional', 'premium'],
      },
      {
        name: 'Múltiplos caixas simultâneos',
        what: 'Vários operadores podem abrir caixa ao mesmo tempo. Cada sessão registra abertura, fechamento, total de vendas e troco.',
        pitch: 'Restaurante grande tem 2-3 caixas ao mesmo tempo. Cada operador tem seu fechamento, sem misturar.',
        objections: [
          { q: 'Só tenho um caixa', a: 'Quando crescer, já está pronto. Sem migrar de sistema.' },
        ],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Gestão de mesas e chamadas',
        what: 'Painel visual das mesas com status (livre/ocupada). Cliente chama garçom pelo cardápio digital, equipe vê notificação na hora.',
        pitch: 'Cliente sentado quer mais cerveja. Toca o botão no celular, garçom recebe alerta no app. Atendimento em 30 segundos.',
        objections: [
          { q: 'Garçom já passa de mesa em mesa', a: 'Mesa cheia, hora do almoço, garçom sumiu. Cliente fica nervoso e não volta. Esse botão resolve.' },
        ],
        demoUrl: '/boteco-do-ze/mesa/1',
        plans: ['professional', 'premium'],
      },
      {
        name: 'Balança digital integrada',
        what: 'Conecta balança via USB/Bluetooth. Vendeu por kg? Sistema lê o peso direto.',
        pitch: 'Restaurante self-service ou açougue: pesou, registrou, cobrou. Sem digitação manual.',
        objections: [],
        plans: ['professional', 'premium'],
      },
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque & Insumos',
    icon: 'Package',
    description: 'Controle de matéria-prima e custos.',
    features: [
      {
        name: 'Controle de estoque com baixa automática',
        what: 'Cadastra insumos (carne, queijo, pão), vincula a produtos via ficha técnica. Vendeu hambúrguer = baixa automática de 150g de carne, 1 pão, 2 fatias de queijo.',
        pitch: 'Você sabe exatamente quanto de cada insumo vai pro lixo, quanto custou cada prato e quando precisa comprar mais.',
        objections: [
          { q: 'Eu controlo na cabeça', a: '3 em cada 4 restaurantes que fecham é por má gestão de estoque. Diferença entre lucro e prejuízo.' },
          { q: 'Dá muito trabalho cadastrar', a: 'Configura uma vez. Depois é só vender. O sistema avisa quando o queijo está acabando.' },
        ],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Alertas de estoque mínimo',
        what: 'Quando insumo cai abaixo do mínimo, dispara notificação no painel + Telegram. Produtos sem ingrediente ficam "esgotado" automaticamente.',
        pitch: 'Você nunca mais vende um prato que não tem como fazer. Cliente não pede o que não pode receber.',
        objections: [],
        plans: ['professional', 'premium'],
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery & Entregadores',
    icon: 'Truck',
    description: 'Operação de entrega ponta a ponta: do pedido à porta do cliente.',
    features: [
      {
        name: 'Gestão de entregadores com PIN único',
        what: 'Cadastra cada motoboy com PIN único de 6 dígitos. Entregador acessa app /entregador com slug + PIN, vê só as entregas atribuídas a ele, status (disponível/ocupado), histórico e ganhos. Restaurante atribui pedidos manualmente.',
        pitch: 'Você tem 5 motoboys? Cada um tem login próprio, vê só as próprias entregas. No fim do dia o sistema mostra quanto cada um entregou e quanto ganhou. Acabou planilha no fim do turno.',
        objections: [
          { q: 'Meu motoboy é fixo, não preciso disso', a: 'Mesmo assim ele vê o endereço, telefone do cliente e marca como entregue no celular. E o histórico fica registrado pra você.' },
        ],
        demoUrl: '/entregador',
        plans: ['professional', 'premium'],
      },
      {
        name: 'Ganhos do entregador automáticos',
        what: 'O valor da taxa de entrega que o restaurante cobra do cliente é o mesmo que o entregador recebe. App mostra resumo Hoje/Semana/Mês em tempo real, com lista detalhada de cada entrega.',
        pitch: 'Motoboy abre o app e já vê quanto vai receber no fim do dia. Sem discussão, sem "esqueci de anotar". Transparente e justo.',
        objections: [],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Live tracking de entregas',
        what: 'Painel ao vivo no admin mostra todas as entregas em curso, status, tempo decorrido. Cliente final acompanha em /pedido/:id em tempo real.',
        pitch: 'Você sabe na hora qual entrega está atrasada e atua antes do cliente reclamar. Cliente acompanha o pedido sem precisar ligar perguntando "cadê?".',
        objections: [],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Alertas de SLA de entrega',
        what: 'Sistema dispara alerta visual + Telegram quando uma entrega ultrapassa o tempo limite definido (ex: 45 min). Identifica gargalos por horário/região.',
        pitch: 'Antes do cliente avaliar 1 estrela, você é avisado que a entrega tá demorando. Liga, justifica, oferece desconto. Salva a relação.',
        objections: [],
        plans: ['premium'],
      },
      {
        name: 'Zonas de entrega com taxas diferentes',
        what: 'Define bairros/raios com taxa específica e tempo estimado. Cliente vê na hora se entrega no endereço dele e quanto custa.',
        pitch: 'Bairro próximo R$5, bairro distante R$12. Cliente sabe antes de pedir. Sem aquela treta de "eu não entrego aí".',
        objections: [],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Mapa ao vivo para o cliente',
        what: 'Cliente acompanha em /pedido/:id o motoboy se movendo no mapa em tempo real (localização do driver via app do entregador).',
        pitch: 'Cliente ansioso? Manda o link, ele vê o motoboy chegando na rua. Reduz ligação de "cadê meu pedido" a zero.',
        objections: [
          { q: 'Meu motoboy vai deixar o GPS ligado?', a: 'É só abrir o app de entrega. GPS já vai junto, sem configuração.' },
        ],
        plans: ['premium'],
      },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing & CRM',
    icon: 'Megaphone',
    description: 'Como atrair, manter e fidelizar clientes.',
    features: [
      {
        name: 'CRM completo de clientes',
        what: 'Cadastro automático no checkout. Histórico de pedidos, ticket médio, frequência, preferências. Segmentação por valor e comportamento.',
        pitch: 'Você sabe quem são seus 10 melhores clientes, o que pedem, quando voltam. Pode mandar oferta personalizada via WhatsApp.',
        objections: [
          { q: 'Já uso planilha', a: 'Planilha não atualiza sozinha, não cruza dados, não te avisa que o João não pede há 30 dias.' },
        ],
        plans: ['premium'],
      },
      {
        name: 'Cupons de desconto',
        what: 'Cria códigos com regras: % ou valor fixo, mínimo de pedido, validade, limite de usos. Aplicado no checkout.',
        pitch: 'Lançamento, retenção, recuperar cliente sumido: cria cupom em 1 minuto, posta no Insta, mede o resultado.',
        objections: [],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Notificações via WhatsApp',
        what: 'Botão gera link wa.me com mensagem pronta (pedido confirmado, pronto, saiu pra entrega). Clica e envia.',
        pitch: 'Cliente recebe atualização do pedido sem precisar abrir o site. Reduz reclamação de "cadê meu pedido?" em 80%.',
        objections: [
          { q: 'Por que não automatizar 100%?', a: 'API oficial do WhatsApp Business custa caro e demora pra aprovar. Aqui é grátis e funciona em qualquer celular.' },
        ],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Pesquisa de satisfação automática',
        what: 'Após pedido entregue, link de avaliação enviado. Coleta nota 1-5 + comentário, divide por categoria (comida, entrega, atendimento). Calcula NPS (Net Promoter Score).',
        pitch: 'Você descobre o que está ruim antes do cliente postar no Google. E identifica seus melhores fãs pra pedir review público.',
        objections: [],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Área do cliente autenticada',
        what: 'Cliente cria conta em /cliente, salva endereços, vê histórico de pedidos, refaz pedido em 1 clique (reorder). Aumenta retenção e LTV.',
        pitch: 'Cliente que cria conta volta 3x mais. Reorder em 1 clique = pedido fechado em 10 segundos. Vira hábito.',
        objections: [
          { q: 'Cliente não vai querer criar conta', a: 'Login é opcional. Quem cria, vira recorrente. Quem não cria, pede como visitante normal.' },
        ],
        demoUrl: '/cliente/login',
        plans: ['professional', 'premium'],
      },
      {
        name: 'Reservas com QR Code',
        what: 'Cliente faz reserva online (data, hora, número de pessoas). Restaurante aprova/recusa, envia QR Code de confirmação. Reduz no-show.',
        pitch: 'Cliente reserva pelo Insta às 23h sem você precisar atender. No dia, mostra o QR e vai direto pra mesa. Profissional como restaurante de chef.',
        objections: [],
        plans: ['professional', 'premium'],
      },
      {
        name: 'Programa de indicação (Indique & Ganhe)',
        what: 'Restaurante ganha crédito na mensalidade indicando outro estabelecimento. Link único de indicação em /restaurant/indique, tracking automático.',
        pitch: 'Indica 3 amigos donos de restaurante, ganha 1 mês grátis. Você já divulga pra gente, agora recebe por isso.',
        objections: [],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Notificações push no navegador',
        what: 'Restaurante recebe push nativo do navegador (funciona com aba fechada) em novos pedidos, chamadas de garçom e alertas críticos. Sem depender de Telegram.',
        pitch: 'Fechou o notebook mas ficou com a aba aberta? Chega push no computador, no celular, do mesmo jeito que WhatsApp Web. Nunca mais perde pedido.',
        objections: [],
        plans: ['basic', 'professional', 'premium'],
      },
    ],
  },
  {
    id: 'nightlife',
    title: 'Modo Balada (Nightlife)',
    icon: 'Music',
    description: 'Suite completa para casas noturnas, baladas e festivais.',
    features: [
      {
        name: 'Line-up de DJs público',
        what: 'Página pública em /:slug/balada mostra o line-up da noite com foto do DJ, horário do set e countdown ao vivo até o próximo. Realtime — atualiza sem refresh.',
        pitch: 'Cliente entra no seu Insta, clica no link, vê quem toca hoje e a que horas. Marketing pronto, sem precisar postar flyer manual.',
        objections: [],
        demoUrl: '/demo/balada',
        plans: ['premium'],
      },
      {
        name: 'Drink da Hora com countdown',
        what: 'Programa promoções por horário (ex: caipirinha R$ 10 das 22h-23h). Aparece em destaque na página pública com timer regressivo.',
        pitch: 'Enche a casa nos horários mortos. Cliente vê "faltam 12min pra acabar" e corre pra pedir. Escassez vende.',
        objections: [],
        plans: ['premium'],
      },
      {
        name: 'Painel DJ + pedidos de música',
        what: 'Cliente pede música pelo cardápio digital (opcionalmente pago), DJ recebe em /dj com aprovação individual ou em massa, motivos de recusa pré-definidos. Escolhe se cobra na comanda individual ou rateia na mesa (billing_mode).',
        pitch: 'DJ vira nova fonte de receita. Cliente paga R$ 5-20 pra pedir uma música, DJ aprova ou recusa no tablet. Dinheiro cai na comanda automaticamente.',
        objections: [
          { q: 'DJ vai perder autonomia', a: 'Ele mesmo aprova. Recusa fácil com motivo pronto ("já toquei", "não combina com o set"). Vira ferramenta, não obrigação.' },
        ],
        plans: ['premium'],
      },
      {
        name: 'Pulseiras cashless (wristbands)',
        what: 'Cada cliente recebe pulseira com código único na entrada. Consome durante a noite (postpaid), paga só na saída. Painel Bar (/bar) vê fila de pedidos em tempo real por pulseira.',
        pitch: 'Cliente não pega dinheiro no meio da pista, você não tem fila no caixa. Consome mais (comprovado: +40% ticket médio) e paga tudo junto na saída.',
        objections: [
          { q: 'E se o cliente sumir sem pagar?', a: 'Pulseira exige documento na entrada (opcional) ou cartão pré-autorizado. Igual balada grande faz.' },
        ],
        plans: ['premium'],
      },
      {
        name: 'Painel Bar em tempo real',
        what: 'Bartenders veem em /bar a fila de pedidos por pulseira/mesa, marcam como servido, priorizam. Igual KDS, mas otimizado pra bebida.',
        pitch: 'Bar cheio, garçom gritando pedido: acabou. Aparece na tela do bar, bartender prepara na ordem, ninguém esquece drink.',
        objections: [],
        plans: ['premium'],
      },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro & Relatórios',
    icon: 'TrendingUp',
    description: 'Inteligência de negócio e gestão financeira.',
    features: [
      {
        name: 'Dashboard em tempo real',
        what: 'KPIs ao vivo: faturamento do dia, ticket médio, pedidos por status, top produtos, comparação com período anterior.',
        pitch: 'Você abre o celular e em 5 segundos sabe se o dia está bom ou ruim. Sem fechar caixa, sem somar planilha.',
        objections: [],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Controle de despesas',
        what: 'Cadastra contas a pagar (aluguel, fornecedores, salários) com vencimento, categoria, recorrência. Alertas de vencimento.',
        pitch: 'Você nunca mais esquece de pagar fornecedor nem leva multa de boleto vencido. Vê o quanto sobra de verdade no fim do mês.',
        objections: [],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Relatórios avançados + exportação',
        what: 'Vendas por período, produto, categoria, forma de pagamento, garçom. Exporta CSV pra contador.',
        pitch: 'Contador recebe planilha pronta. Imposto de renda, simples nacional, tudo organizado.',
        objections: [],
        plans: ['professional', 'premium'],
      },
      {
        name: 'AI Insights',
        what: 'IA analisa os dados e sugere ações: "produto X está caindo 15%", "terça-feira você vende menos, faça promoção", "cliente Y está sumindo".',
        pitch: 'Você tem um consultor de negócios trabalhando 24/7 pra te dizer onde está perdendo dinheiro e onde dá pra ganhar mais.',
        objections: [
          { q: 'IA vai me substituir?', a: 'IA te dá os dados, você decide. É como ter um analista de R$8k/mês incluso na assinatura.' },
        ],
        plans: ['premium'],
      },
    ],
  },
  {
    id: 'integracoes',
    title: 'Integrações & Personalização',
    icon: 'Plug',
    description: 'Como o sistema conecta com o resto da operação.',
    features: [
      {
        name: 'Bot do Telegram inteligente',
        what: 'Bot oficial do Telegram envia alertas em tempo real (novo pedido, estoque baixo, SLA estourado) e aceita comandos: /relatorio (resumo do dia), /comandas (mesas abertas), /abrir e /fechar (controla operação remotamente). Resumo diário automático às 22h. Vinculação multi-tenant via /start.',
        pitch: 'Você fechou o restaurante e foi pra casa. Às 22h chega no Telegram: "Hoje: R$ 4.230, 87 pedidos, ticket médio R$ 48". Domingo na praia, manda /fechar pelo celular. Operação na palma da mão.',
        objections: [
          { q: 'Por que Telegram e não WhatsApp?', a: 'Telegram tem bot oficial gratuito, WhatsApp não. Resultado igual, custo zero.' },
          { q: 'Equipe não usa Telegram', a: 'Instala em 1 minuto, é igualzinho WhatsApp. E só pra receber alertas, não precisa virar usuário.' },
        ],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Pagamento de assinatura via Stripe',
        what: 'Cobrança recorrente da mensalidade Bora Uai 100% via Stripe (checkout embutido). Sistema cria, renova, cancela e faz upgrade/downgrade com proração automaticamente. Em caso de falha de pagamento, notifica restaurante e bloqueia acesso após período de tolerância.',
        pitch: 'Você assina pelo Stripe — cartão internacional ou local — e pronto. Quer trocar de plano? 2 cliques, com proração na hora. Cancelar? 1 clique e usa até o fim do período pago.',
        objections: [
          { q: 'E se falhar a cobrança?', a: 'Stripe tenta de novo automaticamente, te avisa por e-mail e Telegram. Você tem dias de tolerância pra regularizar antes do bloqueio.' },
        ],
        plans: ['basic', 'professional', 'premium'],
      },
      {
        name: 'Multi-tenant white-label completo',
        what: 'Cardápio público adota cor primária e secundária do restaurante + logo + banner + favicon. URL personalizada (slug ou domínio próprio).',
        pitch: 'Seu cardápio digital tem a cara da sua marca, não do Bora Uai. Cliente sente que é seu.',
        objections: [],
        plans: ['professional', 'premium'],
      },
      {
        name: 'API de integração',
        what: 'Endpoints REST pra conectar com sistemas próprios, ERPs, automações (Zapier, Make).',
        pitch: 'Cliente já tem ERP/contabilidade própria? A gente conecta. Sem retrabalho.',
        objections: [],
        plans: ['premium'],
      },
      {
        name: 'Domínio personalizado',
        what: 'Em vez de borauai.com/restaurante, usa cardapio.seurestaurante.com.br',
        pitch: 'Marca premium tem domínio próprio. Passa profissionalismo, ajuda no Google.',
        objections: [],
        plans: ['premium'],
      },
    ],
  },
];

export const SALES_SCRIPTS = {
  abertura: `Oi [NOME], tudo bem? Aqui é o [SEU NOME] do Bora Uai. Vi que você tem o [RESTAURANTE] e queria te mostrar como a gente tem ajudado restaurantes como o seu a economizar 15-30% das taxas do iFood e ainda ter controle total da operação. Tem 5 minutinhos?`,

  qualificacao: [
    'Quantos pedidos vocês fazem por dia em média?',
    'Trabalham com delivery, salão ou os dois?',
    'Quanto vocês pagam hoje em taxa de iFood/Rappi?',
    'Como vocês controlam o estoque hoje?',
    'Quem cuida do financeiro? Tem dificuldade pra fechar caixa?',
  ],

  fechamento: `Olha [NOME], com tudo que conversamos, o plano [PLANO] é o que faz mais sentido pra vocês. São R$ [VALOR]/mês, sem fidelidade, com 14 dias grátis pra testar. Em 1 semana você já vai ver a diferença. Posso configurar pra você começar hoje?`,

  objecaoPreco: `Entendo. Mas pensa comigo: você paga hoje quanto de taxa de iFood por mês? [DEIXA RESPONDER] Só nisso, em 1 mês de pedidos diretos pelo nosso cardápio, você já paga 3 meses do plano. É investimento, não despesa.`,

  objecaoTempo: `Sem problema. Te mando um link pra você ver com calma. E posso te ligar [DIA] pra responder qualquer dúvida? São 14 dias grátis, sem cartão, sem compromisso. Você só perde se não testar.`,
  zapVendas: `Sem problemas, [NOME]! 👊

Vou deixar aqui um resumo do que o Bora Uai faz pelo seu negócio:
✅ Cardápio Digital (venda sem taxas de 27% do iFood)
✅ Gestão de Mesas e Comandas (agilidade no atendimento)
✅ Controle de Estoque e Financeiro (pare de perder dinheiro)

Quando tiver um tempinho, dá uma olhada no nosso site: borauai.com

Se preferir, me avise um horário que fica bom pra gente conversar rapidinho! Boa correria aí! 🚀`
};

export const COMPETITIVE_ADVANTAGES = [
  { vs: 'iFood', advantage: 'Taxa zero por pedido — você fica com 100%. Aqui você paga mensalidade fixa, lá pagam % de cada venda.' },
  { vs: 'Anota AI', advantage: 'Anota AI é só cardápio. Bora Uai tem KDS, estoque, CRM, app garçom, IA de insights — tudo integrado.' },
  { vs: 'Goomer', advantage: 'Goomer cobra setup + mensalidade alta. Bora Uai tem 14 dias grátis, sem setup, mensalidade transparente.' },
  { vs: 'Sistema próprio', advantage: 'Construir custa R$50k+ e demora 6 meses. Bora Uai fica pronto em 1 dia, atualizações automáticas, suporte incluso.' },
  { vs: 'Caderno + WhatsApp', advantage: 'Você perde pedido, perde dinheiro, não sabe quanto vendeu. Sistema profissional paga sozinho em 1 mês.' },
];
