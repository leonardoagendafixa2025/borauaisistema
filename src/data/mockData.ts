// === RESTAURANTS ===
export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo: string;
  banner: string;
  phone: string;
  whatsapp: string;
  email: string;
  cnpj: string;
  address: string;
  city: string;
  plan: 'basic' | 'professional' | 'premium';
  status: 'active' | 'trial' | 'suspended' | 'cancelled' | 'overdue';
  subscriptionEnd: string;
  createdAt: string;
  monthlyRevenue: number;
  totalOrders: number;
  avgTicket: number;
  isOpen: boolean;
  deliveryFee: number;
  minOrder: number;
  prepTime: string;
  deliveryTime: string;
}

export const restaurants: Restaurant[] = [
  {
    id: '1', name: 'Boteco do Zé', slug: 'boteco-do-ze', logo: '', banner: '',
    phone: '(31) 99999-1234', whatsapp: '5531999991234', email: 'contato@botecodeze.com.br',
    cnpj: '12.345.678/0001-01', address: 'Rua Augusta, 1200', city: 'São Paulo - SP',
    plan: 'premium', status: 'active', subscriptionEnd: '2026-04-20', createdAt: '2025-06-15',
    monthlyRevenue: 48520, totalOrders: 1847, avgTicket: 62.50, isOpen: true,
    deliveryFee: 5.99, minOrder: 25, prepTime: '25-35 min', deliveryTime: '40-55 min',
  },
  {
    id: '2', name: 'Sushi Kento', slug: 'sushi-kento', logo: '', banner: '',
    phone: '(31) 98888-5678', whatsapp: '5531988885678', email: 'contato@sushikento.com.br',
    cnpj: '23.456.789/0001-02', address: 'Av. Liberdade, 480', city: 'São Paulo - SP',
    plan: 'professional', status: 'active', subscriptionEnd: '2026-05-10', createdAt: '2025-08-02',
    monthlyRevenue: 72340, totalOrders: 2156, avgTicket: 89.30, isOpen: true,
    deliveryFee: 8.99, minOrder: 40, prepTime: '30-45 min', deliveryTime: '45-60 min',
  },
  {
    id: '3', name: 'Pizza do Nonno', slug: 'pizza-do-nonno', logo: '', banner: '',
    phone: '(21) 97777-9012', whatsapp: '5521977779012', email: 'contato@pizzadononno.com.br',
    cnpj: '34.567.890/0001-03', address: 'Rua Dias Ferreira, 170', city: 'Rio de Janeiro - RJ',
    plan: 'basic', status: 'trial', subscriptionEnd: '2026-04-05', createdAt: '2026-03-05',
    monthlyRevenue: 12890, totalOrders: 342, avgTicket: 54.20, isOpen: false,
    deliveryFee: 6.99, minOrder: 30, prepTime: '35-50 min', deliveryTime: '50-70 min',
  },
  {
    id: '4', name: 'Açaí da Praia', slug: 'acai-da-praia', logo: '', banner: '',
    phone: '(71) 96666-3456', whatsapp: '5571966663456', email: 'contato@acaidapraia.com.br',
    cnpj: '45.678.901/0001-04', address: 'Av. Oceânica, 3500', city: 'Salvador - BA',
    plan: 'professional', status: 'active', subscriptionEnd: '2026-06-15', createdAt: '2025-09-20',
    monthlyRevenue: 35670, totalOrders: 1523, avgTicket: 28.40, isOpen: true,
    deliveryFee: 4.99, minOrder: 15, prepTime: '10-15 min', deliveryTime: '25-35 min',
  },
  {
    id: '5', name: 'Burger House', slug: 'burger-house', logo: '', banner: '',
    phone: '(31) 95555-7890', whatsapp: '5531955557890', email: 'contato@burgerhouse.com.br',
    cnpj: '56.789.012/0001-05', address: 'Rua da Bahia, 1400', city: 'Belo Horizonte - MG',
    plan: 'premium', status: 'overdue', subscriptionEnd: '2026-03-01', createdAt: '2025-04-10',
    monthlyRevenue: 58210, totalOrders: 2890, avgTicket: 47.80, isOpen: true,
    deliveryFee: 7.49, minOrder: 20, prepTime: '20-30 min', deliveryTime: '35-50 min',
  },
  {
    id: '6', name: 'Cantina Bella', slug: 'cantina-bella', logo: '', banner: '',
    phone: '(41) 94444-1234', whatsapp: '5541944441234', email: 'contato@cantinabella.com.br',
    cnpj: '67.890.123/0001-06', address: 'Rua XV de Novembro, 890', city: 'Curitiba - PR',
    plan: 'basic', status: 'suspended', subscriptionEnd: '2026-02-15', createdAt: '2025-07-01',
    monthlyRevenue: 0, totalOrders: 567, avgTicket: 72.10, isOpen: false,
    deliveryFee: 5.49, minOrder: 35, prepTime: '30-45 min', deliveryTime: '45-60 min',
  },
];

// === CATEGORIES ===
export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  order: number;
  active: boolean;
}

export const categories: Category[] = [
  { id: 'c1', restaurantId: '1', name: 'Petiscos', description: 'Para abrir o apetite', order: 1, active: true },
  { id: 'c2', restaurantId: '1', name: 'Pratos Principais', description: 'O melhor da casa', order: 2, active: true },
  { id: 'c3', restaurantId: '1', name: 'Bebidas', description: 'Cervejas, sucos e mais', order: 3, active: true },
  { id: 'c4', restaurantId: '1', name: 'Sobremesas', description: 'Doçura pra fechar', order: 4, active: true },
];

// === PRODUCTS ===
export interface Product {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number;
  image: string;
  active: boolean;
  featured: boolean;
  soldOut: boolean;
}

export const products: Product[] = [
  { id: 'p1', restaurantId: '1', categoryId: 'c1', name: 'Bolinho de Bacalhau', description: 'Porção com 8 unidades crocantes por fora e macios por dentro. Acompanha molho tártaro.', price: 32.90, image: '', active: true, featured: true, soldOut: false },
  { id: 'p2', restaurantId: '1', categoryId: 'c1', name: 'Calabresa Acebolada', description: 'Calabresa fatiada na chapa com cebolas caramelizadas. Serve 2 pessoas.', price: 38.90, image: '', active: true, featured: false, soldOut: false },
  { id: 'p3', restaurantId: '1', categoryId: 'c1', name: 'Batata Frita Crocante', description: 'Porção generosa de batata palito com alecrim e sal grosso.', price: 24.90, image: '', active: true, featured: false, soldOut: false },
  { id: 'p4', restaurantId: '1', categoryId: 'c2', name: 'Picanha na Brasa', description: 'Picanha grelhada com arroz, farofa, vinagrete e mandioca frita. 450g.', price: 79.90, promoPrice: 69.90, image: '', active: true, featured: true, soldOut: false },
  { id: 'p5', restaurantId: '1', categoryId: 'c2', name: 'Filé de Frango Grelhado', description: 'Filé de frango com legumes salteados, arroz integral e salada.', price: 42.90, image: '', active: true, featured: false, soldOut: false },
  { id: 'p6', restaurantId: '1', categoryId: 'c2', name: 'Feijoada Completa', description: 'Feijoada com todas as carnes, arroz, couve, farofa e laranja. Serve 1.', price: 54.90, image: '', active: true, featured: true, soldOut: false },
  { id: 'p7', restaurantId: '1', categoryId: 'c3', name: 'Caipirinha Tradicional', description: 'Limão, açúcar e cachaça artesanal.', price: 18.90, image: '', active: true, featured: false, soldOut: false },
  { id: 'p8', restaurantId: '1', categoryId: 'c3', name: 'Cerveja Artesanal IPA', description: 'Pint de 500ml. Amargor equilibrado com notas cítricas.', price: 22.90, image: '', active: true, featured: false, soldOut: false },
  { id: 'p9', restaurantId: '1', categoryId: 'c3', name: 'Suco Natural', description: 'Laranja, abacaxi, maracujá ou limão. 400ml.', price: 12.90, image: '', active: true, featured: false, soldOut: true },
  { id: 'p10', restaurantId: '1', categoryId: 'c4', name: 'Pudim de Leite', description: 'Receita da vovó. Cremoso, com calda de caramelo.', price: 16.90, image: '', active: true, featured: false, soldOut: false },
  { id: 'p11', restaurantId: '1', categoryId: 'c4', name: 'Petit Gâteau', description: 'Bolo de chocolate com recheio cremoso e sorvete de baunilha.', price: 28.90, image: '', active: true, featured: true, soldOut: false },
];

// === ORDERS ===
export type OrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'delivering' | 'waiting_pickup' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  restaurantId: string;
  number: number;
  customerName: string;
  customerPhone: string;
  type: 'delivery' | 'pickup' | 'dine_in';
  status: OrderStatus;
  items: { name: string; qty: number; price: number; notes?: string }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  payment: string;
  address?: string;
  createdAt: string;
}

export const orders: Order[] = [
  {
    id: 'o1', restaurantId: '1', number: 1047, customerName: 'Marina Costa', customerPhone: '(31) 99123-4567',
    type: 'delivery', status: 'new',
    items: [
      { name: 'Picanha na Brasa', qty: 1, price: 69.90 },
      { name: 'Caipirinha Tradicional', qty: 2, price: 18.90 },
      { name: 'Petit Gâteau', qty: 1, price: 28.90 },
    ],
    subtotal: 136.60, deliveryFee: 5.99, total: 142.59, payment: 'Cartão de crédito',
    address: 'Rua Oscar Freire, 450 - Ap 82', createdAt: '2026-03-20T18:32:00',
  },
  {
    id: 'o2', restaurantId: '1', number: 1046, customerName: 'Rafael Oliveira', customerPhone: '(31) 98765-4321',
    type: 'pickup', status: 'preparing',
    items: [
      { name: 'Bolinho de Bacalhau', qty: 2, price: 32.90 },
      { name: 'Cerveja Artesanal IPA', qty: 3, price: 22.90 },
    ],
    subtotal: 134.50, deliveryFee: 0, total: 134.50, payment: 'PIX',
    createdAt: '2026-03-20T18:15:00',
  },
  {
    id: 'o3', restaurantId: '1', number: 1045, customerName: 'Camila Santos', customerPhone: '(31) 97654-3210',
    type: 'delivery', status: 'delivering',
    items: [
      { name: 'Feijoada Completa', qty: 2, price: 54.90 },
      { name: 'Suco Natural', qty: 2, price: 12.90 },
    ],
    subtotal: 135.60, deliveryFee: 5.99, total: 141.59, payment: 'Cartão de débito',
    address: 'Av. Paulista, 1578 - Conj 1204', createdAt: '2026-03-20T17:48:00',
  },
  {
    id: 'o4', restaurantId: '1', number: 1044, customerName: 'Lucas Ferreira', customerPhone: '(31) 96543-2109',
    type: 'dine_in', status: 'completed',
    items: [
      { name: 'Calabresa Acebolada', qty: 1, price: 38.90 },
      { name: 'Batata Frita Crocante', qty: 1, price: 24.90 },
      { name: 'Caipirinha Tradicional', qty: 4, price: 18.90 },
    ],
    subtotal: 139.40, deliveryFee: 0, total: 139.40, payment: 'Dinheiro',
    createdAt: '2026-03-20T16:20:00',
  },
  {
    id: 'o5', restaurantId: '1', number: 1043, customerName: 'Ana Paula Lima', customerPhone: '(31) 95432-1098',
    type: 'delivery', status: 'completed',
    items: [
      { name: 'Filé de Frango Grelhado', qty: 1, price: 42.90 },
      { name: 'Pudim de Leite', qty: 1, price: 16.90 },
    ],
    subtotal: 59.80, deliveryFee: 5.99, total: 65.79, payment: 'PIX',
    address: 'Rua Consolação, 2800 - Ap 33', createdAt: '2026-03-20T14:05:00',
  },
];

// === PLATFORM METRICS ===
export const platformMetrics = {
  totalRestaurants: 6,
  activeRestaurants: 3,
  trialRestaurants: 1,
  suspendedRestaurants: 1,
  overdueRestaurants: 1,
  totalOrders: 9325,
  totalRevenue: 227630,
  monthlyRecurring: 4870,
  avgTicket: 57.40,
  ordersToday: 184,
  revenueToday: 12480,
};

// === SUBSCRIPTION PLANS ===
export const plans = [
  { id: 'basic', name: 'Básico', price: 97, users: 2, features: ['Cardápio online', 'Gestão de pedidos', 'Relatórios básicos'] },
  { id: 'professional', name: 'Profissional', price: 197, users: 5, features: ['Tudo do Básico', 'Cupons e promoções', 'Relatórios avançados', 'Personalização visual'] },
  { id: 'premium', name: 'Premium', price: 297, users: 10, features: ['Tudo do Profissional', 'Domínio próprio', 'Multi-usuários', 'API e integrações', 'Suporte prioritário'] },
];
