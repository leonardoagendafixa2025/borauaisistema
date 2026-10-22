import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Clock, MapPin, Plus, Minus, X, ChevronRight, ShoppingBag, ArrowLeft, Truck, Store, CreditCard, Banknote, QrCode, Smartphone, User, ChevronDown, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import ScrollReveal from '@/components/ScrollReveal';
import PromoBanners from '@/components/PromoBanners';
import PublicBottomNav from '@/components/PublicBottomNav';
import RestaurantLanding from './RestaurantLanding';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePublicRestaurant, usePublicCategories, usePublicProducts, usePublicSettings, usePublicDeliveryZones, usePublicCombos } from '@/hooks/useRestaurantData';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { useRestaurantTheme } from '@/hooks/useRestaurantTheme';
import { useRestaurantReservationsEnabled } from '@/hooks/useRestaurantReservationsEnabled';
import { useQuery } from '@tanstack/react-query';
import { getCategoryEmoji } from '@/lib/categoryEmoji';
import { useTheme } from '@/hooks/useTheme';
import { sendPushNewOrder } from '@/lib/pushNotifications';

type Product = Database['public']['Tables']['products']['Row'];
type OrderType = 'delivery' | 'pickup';

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface SelectedOption { groupId: string; optionId: string; name: string; price: number; }
interface CartItem {
  product?: Product;
  combo?: { id: string; name: string; price: number; image_url: string | null; description?: string | null };
  qty: number;
  notes: string;
  options: SelectedOption[];
}
const itemId = (i: CartItem) => i.product?.id || `combo:${i.combo?.id}`;
const itemName = (i: CartItem) => i.product?.name || i.combo?.name || '';
const itemUnitPrice = (i: CartItem) =>
  i.product ? Number(i.product.promo_price || i.product.price) : Number(i.combo?.price || 0);
const itemImage = (i: CartItem) => i.product?.image_url || i.combo?.image_url || null;

const PAYMENT_OPTIONS: { key: string; label: string; icon: typeof CreditCard }[] = [
  { key: 'pix', label: 'PIX', icon: QrCode },
  { key: 'cash', label: 'Dinheiro', icon: Banknote },
  { key: 'credit_card', label: 'Crédito', icon: CreditCard },
  { key: 'debit_card', label: 'Débito', icon: Smartphone },
];

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: restaurant, isLoading: loadingRestaurant } = usePublicRestaurant(slug);
  const { data: categories = [] } = usePublicCategories(restaurant?.id);
  const { data: products = [] } = usePublicProducts(restaurant?.id);
  const { data: settings } = usePublicSettings(restaurant?.id);
  const { data: zones = [] } = usePublicDeliveryZones(restaurant?.id);
  const { data: combos = [] } = usePublicCombos(restaurant?.id);
  const { enabled: reservationsEnabled } = useRestaurantReservationsEnabled(restaurant?.id);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Public menu uses fixed coral theme (scoped via .font-public). Do not inherit
  // restaurant primary color here — it would override coral with brand greens, etc.
  // useRestaurantTheme(settings?.primary_color, settings?.secondary_color);

  // Use global theme provider — toggles dark across the entire app
  const { theme: themeMode, toggle: toggleTheme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [needsChange, setNeedsChange] = useState<'yes' | 'no' | null>(null);
  const [changeFor, setChangeFor] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Customer auth state for saved addresses
  const [customerUser, setCustomerUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCustomerUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setCustomerUser(s?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Persist current restaurant slug so back-navigation from sub-pages returns here
  useEffect(() => {
    if (slug) sessionStorage.setItem('lastRestaurantSlug', slug);
  }, [slug]);

  // Fetch saved addresses if logged in
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['customer-addresses-checkout', customerUser?.id, restaurant?.id],
    queryFn: async () => {
      if (!customerUser || !restaurant) return [];
      const { data: customer } = await supabase.from('customers').select('id').eq('user_id', customerUser.id).eq('restaurant_id', restaurant.id).maybeSingle();
      if (!customer) return [];
      const { data } = await supabase.from('addresses').select('*').eq('customer_id', customer.id).order('is_default', { ascending: false });
      return data || [];
    },
    enabled: !!customerUser && !!restaurant,
  });

  // Auto-fill from saved addresses
  useEffect(() => {
    if (savedAddresses.length > 0 && !address) {
      const defaultAddr = savedAddresses.find((a: any) => a.is_default) || savedAddresses[0];
      const parts = [defaultAddr.street, defaultAddr.number, defaultAddr.complement, defaultAddr.neighborhood, defaultAddr.city, defaultAddr.state].filter(Boolean);
      setAddress(parts.join(', '));
    }
  }, [savedAddresses]);

  // Auto-fill customer data from auth (name + phone from any prior customer record)
  useEffect(() => {
    if (!customerUser) return;
    if (!customerName) {
      setCustomerName(customerUser.user_metadata?.full_name || '');
    }
    if (!customerPhone) {
      supabase.from('customers').select('phone, name').eq('user_id', customerUser.id).not('phone', 'is', null).limit(1).maybeSingle()
        .then(({ data }) => {
          if (data?.phone) setCustomerPhone(data.phone);
          if (data?.name) setCustomerName((cur) => cur || data.name);
        });
    }
  }, [customerUser]);

  // Restore checkout draft after returning from login
  useEffect(() => {
    if (!restaurant || !customerUser) return;
    const draftKey = `checkout_draft_${restaurant.id}`;
    const raw = sessionStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.cart?.length) setCart(draft.cart);
      if (draft.orderType) setOrderType(draft.orderType);
      if (draft.address) setAddress(draft.address);
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      if (draft.notes) setNotes(draft.notes);
      sessionStorage.removeItem(draftKey);
      setCartOpen(true);
    } catch { /* ignore */ }
  }, [restaurant, customerUser]);

  const deliveryEnabled = settings?.delivery_enabled ?? true;
  const pickupEnabled = settings?.pickup_enabled ?? true;

  const menuProducts = products.filter(p => !p.sold_out);

  const filteredProducts = useMemo(() => {
    return menuProducts.filter(p => {
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesCat = !activeCategory || p.category_id === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [search, activeCategory, menuProducts]);

  // Featured products (top of list, big cards) — must be declared before any early returns
  const featuredProducts = useMemo(
    () => menuProducts.filter(p => p.featured).slice(0, 8),
    [menuProducts]
  );

  const cartTotal = cart.reduce((sum, item) => {
    const basePrice = itemUnitPrice(item);
    const optionsPrice = (item.options || []).reduce((s, o) => s + o.price, 0);
    return sum + (basePrice + optionsPrice) * item.qty;
  }, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const selectedZone = zones.find((z: any) => z.id === selectedZoneId);
  const deliveryFee = orderType === 'delivery'
    ? (selectedZone ? Number(selectedZone.delivery_fee) : Number(settings?.delivery_fee || 0))
    : 0;
  const grandTotal = cartTotal + deliveryFee;
  const minOrderValue = selectedZone && Number(selectedZone.min_order_value) > 0
    ? Number(selectedZone.min_order_value)
    : Number(settings?.min_order_value || 0);

  const availablePayments = useMemo(() => {
    const methods = settings?.payment_methods as string[] | null;
    if (!methods || methods.length === 0) return PAYMENT_OPTIONS;
    return PAYMENT_OPTIONS.filter(p => methods.includes(p.key));
  }, [settings?.payment_methods]);

  const effectiveOrderType = useMemo(() => {
    if (orderType) return orderType;
    if (deliveryEnabled && !pickupEnabled) return 'delivery';
    if (!deliveryEnabled && pickupEnabled) return 'pickup';
    return null;
  }, [orderType, deliveryEnabled, pickupEnabled]);

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setSelectedOptions([]);
    setLoadingOptions(true);
    try {
      const { data: groups } = await publicSupabase
        .from('product_option_groups')
        .select('*, product_options(*)')
        .eq('product_id', product.id)
        .order('sort_order');
      setProductOptions(groups || []);
    } catch { setProductOptions([]); }
    setLoadingOptions(false);
  };

  const toggleOption = (groupId: string, option: any, maxSelections: number) => {
    setSelectedOptions(prev => {
      const existing = prev.find(o => o.optionId === option.id);
      if (existing) return prev.filter(o => o.optionId !== option.id);
      const groupCount = prev.filter(o => o.groupId === groupId).length;
      if (groupCount >= maxSelections) {
        // Replace last selected in this group
        const withoutGroup = prev.filter(o => o.groupId !== groupId);
        return [...withoutGroup, { groupId, optionId: option.id, name: option.name, price: Number(option.price) }];
      }
      return [...prev, { groupId, optionId: option.id, name: option.name, price: Number(option.price) }];
    });
  };

  const addToCart = (product: Product) => {
    // Validate required option groups
    for (const group of productOptions) {
      if (group.required) {
        const selected = selectedOptions.filter((o: SelectedOption) => o.groupId === group.id);
        if (selected.length < group.min_selections) {
          toast.error(`Selecione pelo menos ${group.min_selections} opção em "${group.name}"`);
          return;
        }
      }
    }
    setCart(prev => [...prev, { product, qty: 1, notes: '', options: [...selectedOptions] }]);
    setSelectedProduct(null);
    setSelectedOptions([]);
    setProductOptions([]);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (itemId(i) !== id) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null! : { ...i, qty: newQty };
    }).filter(Boolean));
  };

  const addComboToCart = (combo: any) => {
    setCart(prev => [...prev, {
      combo: { id: combo.id, name: combo.name, price: Number(combo.price), image_url: combo.image_url, description: combo.description },
      qty: 1, notes: '', options: [],
    }]);
    toast.success(`${combo.name} adicionado`);
  };

  const canSubmit = () => {
    if (!effectiveOrderType) return false;
    if (!customerName.trim()) return false;
    if (!customerPhone.trim()) return false;
    if (!paymentMethod) return false;
    if (paymentMethod === 'cash' && needsChange === null) return false;
    if (paymentMethod === 'cash' && needsChange === 'yes') {
      const v = parseFloat(changeFor.replace(',', '.'));
      if (!v || v < grandTotal) return false;
    }
    if (effectiveOrderType === 'delivery' && !address.trim()) return false;
    if (effectiveOrderType === 'delivery' && zones.length > 0 && !selectedZoneId) return false;
    if (minOrderValue > 0 && cartTotal < minOrderValue) return false;
    return true;
  };


  const saveDraftAndGoLogin = (mode: 'login' | 'register' = 'login') => {
    if (!restaurant) return;
    const draft = { cart, orderType, address, paymentMethod, notes };
    sessionStorage.setItem(`checkout_draft_${restaurant.id}`, JSON.stringify(draft));
    const returnTo = encodeURIComponent(`/${restaurant.slug}`);
    navigate(`/cliente/login?mode=${mode}&returnTo=${returnTo}`);
  };

  const handleSubmitOrder = async () => {
    if (!restaurant) return;

    // Require authentication so the order is linked to the customer's account
    if (!customerUser) {
      toast.info('Entre ou crie sua conta para finalizar o pedido');
      saveDraftAndGoLogin('login');
      return;
    }

    // Rate limiting: max 5 orders per 10 minutes
    const RATE_KEY = `order_timestamps_${restaurant.id}`;
    const now = Date.now();
    const timestamps: number[] = JSON.parse(sessionStorage.getItem(RATE_KEY) || '[]').filter((t: number) => now - t < 600000);
    if (timestamps.length >= 5) {
      toast.error('Muitos pedidos em pouco tempo. Aguarde alguns minutos.');
      return;
    }

    if (!restaurant.is_open || restaurant.force_closed) {
      toast.error('O restaurante está fechado no momento');
      return;
    }
    // Validate opening hours
    if (settings?.opening_hours && typeof settings.opening_hours === 'object') {
      const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const daysPt = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const now = new Date();
      const currentDayKey = dayKeys[now.getDay()];
      const currentDayPt = daysPt[now.getDay()];

      const hoursConfig = settings.opening_hours as Record<string, any>;
      const hours = hoursConfig[currentDayKey] || hoursConfig[currentDayPt];

      if (hours) {
        if (hours.enabled === false) {
          toast.error('O restaurante está fechado hoje');
          return;
        }

        if (hours.open && hours.close) {
          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          let isOpenNow = false;

          if (hours.close < hours.open) {
            // Overnight hours (e.g., 18:00 to 02:00)
            isOpenNow = currentTime >= hours.open || currentTime <= hours.close;
          } else {
            // Standard daytime hours (e.g., 11:00 to 23:00)
            isOpenNow = currentTime >= hours.open && currentTime <= hours.close;
          }

          if (!isOpenNow) {
            toast.error(`Fora do horário de funcionamento (${hours.open} - ${hours.close})`);
            return;
          }
        }
      }
    }
    if (!customerName.trim()) { toast.error('Informe seu nome'); return; }
    if (!customerPhone.trim()) { toast.error('Informe seu telefone'); return; }
    if (!effectiveOrderType) { toast.error('Selecione o tipo de pedido'); return; }
    if (!paymentMethod) { toast.error('Selecione a forma de pagamento'); return; }
    let changeNote = '';
    if (paymentMethod === 'cash') {
      if (needsChange === null) { toast.error('Informe se precisa de troco'); return; }
      if (needsChange === 'yes') {
        const v = parseFloat(changeFor.replace(',', '.'));
        if (!v || v <= 0) { toast.error('Informe o valor para troco'); return; }
        if (v < grandTotal) { toast.error(`Valor para troco deve ser maior que ${formatCurrency(grandTotal)}`); return; }
        changeNote = `[Troco para ${formatCurrency(v)} — levar ${formatCurrency(v - grandTotal)}]`;
      } else {
        changeNote = '[Não precisa de troco]';
      }
    }
    if (effectiveOrderType === 'delivery' && !address.trim()) { toast.error('Informe o endereço de entrega'); return; }
    if (effectiveOrderType === 'delivery' && zones.length > 0 && !selectedZoneId) { toast.error('Selecione o bairro de entrega'); return; }
    if (minOrderValue > 0 && cartTotal < minOrderValue) { toast.error(`Pedido mínimo: ${formatCurrency(minOrderValue)}`); return; }

    setSubmitting(true);
    try {
      // Auto-create/update customer record (linked to authenticated user)
      let customerId: string | null = null;
      try {
        const phone = customerPhone.trim().replace(/\D/g, '');
        // Prefer existing record linked to this user for this restaurant
        const { data: byUser } = await supabase
          .from('customers')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('user_id', customerUser.id)
          .maybeSingle();

        if (byUser) {
          customerId = byUser.id;
          await supabase.from('customers').update({ name: customerName.trim(), phone, email: customerUser.email || null } as any).eq('id', byUser.id);
        } else {
          // Try to attach an existing phone-based customer to this user
          const { data: byPhone } = await supabase
            .from('customers')
            .select('id, user_id')
            .eq('restaurant_id', restaurant.id)
            .eq('phone', phone)
            .maybeSingle();
          if (byPhone) {
            customerId = byPhone.id;
            if (!byPhone.user_id) {
              await supabase.from('customers').update({ user_id: customerUser.id, name: customerName.trim(), email: customerUser.email || null } as any).eq('id', byPhone.id);
            }
          } else {
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                restaurant_id: restaurant.id,
                name: customerName.trim(),
                phone,
                email: customerUser.email || null,
                user_id: customerUser.id,
              })
              .select('id')
              .single();
            if (newCustomer) customerId = newCustomer.id;
          }
        }
      } catch (e) {
        console.warn('Customer link failed (non-blocking):', e);
      }

      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_id: customerId,
        type: effectiveOrderType,
        subtotal: cartTotal,
        delivery_fee: deliveryFee,
        total: grandTotal,
        address: effectiveOrderType === 'delivery' ? address : null,
        delivery_zone_id: selectedZoneId || null,
        payment_method: paymentMethod,
        notes: [changeNote, notes].filter(Boolean).join(' ').trim() || null,
      } as any).select().single();
      if (orderErr) throw orderErr;

      const items = cart.map(i => {
        const unit = itemUnitPrice(i);
        const optsTotal = (i.options || []).reduce((s, o) => s + o.price, 0);
        const isCombo = !!i.combo;
        return {
          order_id: order.id,
          product_id: i.product?.id || null,
          name: isCombo ? `[Combo] ${i.combo!.name}` : i.product!.name,
          qty: i.qty,
          unit_price: unit,
          total_price: (unit + optsTotal) * i.qty,
          notes: i.notes || null,
          options: i.options && i.options.length > 0 ? i.options.map(o => ({ name: o.name, price: o.price })) : null,
        };
      });
      const { error: itemsError } = await supabase.from('order_items').insert(items);
      if (itemsError) throw itemsError;

      // Dispara notificação push instantânea para garçom/cozinha do restaurante
      sendPushNewOrder(restaurant.id, {
        order_id: order.id,
        number: order.number,
        customer_name: customerName,
        type: effectiveOrderType,
        total: grandTotal,
      }).catch(() => {});

      // Record timestamp for rate limiting
      timestamps.push(now);
      sessionStorage.setItem(RATE_KEY, JSON.stringify(timestamps));
      toast.success('Pedido enviado com sucesso!');
      setCart([]);
      setCartOpen(false);
      navigate(`/pedido/${order.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic SEO + Restaurant structured data
  useEffect(() => {
    if (!restaurant) return;
    document.title = `${restaurant.name} — Cardápio Online`;
    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute('content') ?? null;
    if (metaDesc) metaDesc.setAttribute('content', `Peça online no ${restaurant.name}. Delivery, retirada e mesa via QR Code.`);

    const canonical = document.querySelector('link[rel="canonical"]');
    const prevCanon = canonical?.getAttribute('href') ?? null;
    canonical?.setAttribute('href', `/${restaurant.slug}`);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const prevOg = ogUrl?.getAttribute('content') ?? null;
    ogUrl?.setAttribute('content', `/${restaurant.slug}`);

    const ld: any = {
      '@context': 'https://schema.org',
      '@type': ['Restaurant', 'FoodEstablishment'],
      name: restaurant.name,
      description: (restaurant as any).description || `Cardápio online de ${restaurant.name}.`,
      url: `https://borauai.com/${restaurant.slug}`,
      servesCuisine: (restaurant as any).cuisine_type || undefined,
      image: (restaurant as any).logo_url || (restaurant as any).banner_url || undefined,
      telephone: (restaurant as any).phone || undefined,
    };
    const addr = (restaurant as any).address;
    if (addr) ld.address = { '@type': 'PostalAddress', streetAddress: addr };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'restaurant-jsonld';
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);

    return () => {
      document.title = 'Bora Uai — Sistema para bares, restaurantes e baladas';
      if (prevDesc !== null) metaDesc?.setAttribute('content', prevDesc);
      if (prevCanon !== null) canonical?.setAttribute('href', prevCanon);
      if (prevOg !== null) ogUrl?.setAttribute('content', prevOg);
      document.getElementById('restaurant-jsonld')?.remove();
    };
  }, [restaurant]);

  if (loadingRestaurant) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <h1 className="font-heading text-xl font-bold mb-2">Restaurante não encontrado</h1>
          <p className="text-sm text-muted-foreground mb-4">Verifique se o endereço está correto ou volte para a página inicial.</p>
          <a href="/" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ir para o início</a>
        </div>
      </div>
    );
  }

  if (['suspended', 'cancelled', 'overdue'].includes(restaurant.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="font-heading text-xl font-bold mb-2">Restaurante indisponível</h1>
          <p className="text-sm text-muted-foreground mb-4">
            O {restaurant.name} está temporariamente fora do ar. Tente novamente mais tarde.
          </p>
          <a href="/" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ir para o início</a>
        </div>
      </div>
    );
  }

  // Se delivery e retirada estão desativados, mostrar landing universal do restaurante
  // (ex: estabelecimentos focados em mesa/QR, balada, ou só reservas)
  if (settings && !settings.delivery_enabled && !settings.pickup_enabled) {
    return <RestaurantLanding restaurant={restaurant} settings={settings} customerLoggedIn={!!customerUser} />;
  }

  const isClosed = !restaurant.is_open || restaurant.force_closed;



  return (
    <div className="font-public min-h-screen bg-[hsl(var(--primary-soft))] text-foreground selection:bg-primary/30 selection:text-primary">

      {/* ============ HERO — Compact, app-style, fully responsive ============ */}
      <header className="relative">
        <div
          className={`relative overflow-hidden ${
            restaurant.banner_url
              ? 'h-[240px] sm:h-[300px] md:h-[340px] lg:h-[400px]'
              : 'h-[160px] sm:h-[180px] md:h-[200px]'
          }`}
        >
          {restaurant.banner_url ? (
            <img src={restaurant.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.45),transparent_55%),radial-gradient(circle_at_80%_80%,hsl(var(--accent)/0.35),transparent_60%),hsl(var(--background))]" />
          )}
          {/* Smooth fade to background */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background" />

          {/* Floating top bar */}
          <div className="absolute inset-x-0 top-0 z-20 public-container pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between">
            <Link to="/" aria-label="Voltar" className="tactile inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-card/85 backdrop-blur-xl ring-1 ring-border/40 shadow-lg">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
            <div className="flex items-center gap-2">
              {settings?.estimated_prep_time && !isClosed && (
                <span className="inline-flex items-center gap-1.5 h-10 sm:h-11 px-3 sm:px-4 rounded-full bg-card/85 backdrop-blur-xl ring-1 ring-border/40 shadow-lg text-xs sm:text-sm font-bold">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {settings.estimated_prep_time}min
                </span>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
                className="tactile inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-card/85 backdrop-blur-xl ring-1 ring-border/40 shadow-lg"
              >
                {themeMode === 'dark'
                  ? <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                  : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
              <Link to={customerUser ? '/cliente' : '/meus-pedidos'} aria-label="Conta" className="tactile inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-card/85 backdrop-blur-xl ring-1 ring-border/40 shadow-lg">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Identity card — overlaps hero */}
        <div className="public-container -mt-16 sm:-mt-20 relative z-10 animate-reveal-up">
          <div className="relative rounded-3xl bg-card ring-1 ring-border/40 p-4 sm:p-5 md:p-6 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.4)]">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-2xl bg-card ring-4 ring-card shadow-2xl shrink-0 overflow-hidden -mt-10 sm:-mt-12 md:-mt-14 flex items-center justify-center">
                {restaurant.logo_url
                  ? <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-cover" />
                  : <span className="font-display font-black text-2xl sm:text-3xl md:text-4xl bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">{restaurant.name.charAt(0)}</span>}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`h-2 w-2 rounded-full ${!isClosed ? 'bg-primary animate-pulse-soft' : 'bg-destructive'} shadow-[0_0_8px_currentColor]`} />
                  <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] ${!isClosed ? 'text-primary' : 'text-destructive'}`}>
                    {!isClosed ? 'Aberto agora' : 'Fechado'}
                  </span>
                </div>
                <h1 className="font-display font-black hero-title break-words line-clamp-2">
                  {restaurant.name}
                </h1>
                {restaurant.address && (
                  <p className="mt-1 text-[11px] sm:text-xs md:text-sm text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{restaurant.address}{restaurant.city ? `, ${restaurant.city}` : ''}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Info chips row */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {settings?.estimated_prep_time && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-muted px-2.5 py-1 rounded-full">
                  <Clock className="h-3 w-3 text-primary" /> {settings.estimated_prep_time} min
                </span>
              )}
              {deliveryEnabled && Number(settings?.delivery_fee || 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-muted px-2.5 py-1 rounded-full">
                  <Truck className="h-3 w-3 text-primary" /> {formatCurrency(Number(settings?.delivery_fee || 0))}
                </span>
              )}
              {deliveryEnabled && Number(settings?.delivery_fee || 0) === 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black bg-primary/12 text-primary px-2.5 py-1 rounded-full ring-1 ring-primary/25">
                  <Truck className="h-3 w-3" /> ENTREGA GRÁTIS
                </span>
              )}
              {minOrderValue > 0 && (
                <span className="inline-flex items-center text-[11px] font-bold bg-muted px-2.5 py-1 rounded-full">
                  Mín {formatCurrency(minOrderValue)}
                </span>
              )}
              {reservationsEnabled && (
                <Link to={`/${slug}/reservar`} className="tactile inline-flex items-center gap-1 text-[11px] font-bold bg-accent/15 text-accent px-2.5 py-1 rounded-full ring-1 ring-accent/30 hover:bg-accent/25 transition-colors">
                  📅 Reservar
                </Link>
              )}
            </div>

            {/* Order type — segmented control */}
            {deliveryEnabled && pickupEnabled && (
              <div className="relative mt-4 grid grid-cols-2 gap-1 p-1 bg-muted rounded-2xl">
                <button onClick={() => setOrderType('delivery')}
                  className={`tactile relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black uppercase tracking-wide transition-all ${
                    effectiveOrderType === 'delivery' ? 'bg-card text-foreground shadow-md' : 'text-muted-foreground'
                  }`}>
                  <Truck className="h-3.5 w-3.5" /> Entrega
                </button>
                <button onClick={() => setOrderType('pickup')}
                  className={`tactile relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black uppercase tracking-wide transition-all ${
                    effectiveOrderType === 'pickup' ? 'bg-card text-foreground shadow-md' : 'text-muted-foreground'
                  }`}>
                  <Store className="h-3.5 w-3.5" /> Retirada
                </button>
              </div>
            )}
          </div>

          {isClosed && (
            <div className="mt-3 rounded-2xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-center">
              <p className="text-sm font-black text-destructive">🔒 Fechado no momento</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Explore o cardápio e volte em breve</p>
            </div>
          )}
        </div>
      </header>

      {/* ============ STICKY: Search + Categories pills ============ */}
      {/* ============ STICKY SEARCH ============ */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-2xl border-b border-border/50 mt-6">
        <div className="public-container py-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
            <input
              id="public-menu-search"
              type="text"
              placeholder="Você está com fome de quê?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 rounded-2xl bg-muted border border-transparent pl-12 pr-10 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-card transition-all placeholder:text-muted-foreground/70"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-background/60">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Filtro ativo — pill removível */}
          {activeCategory && (
            <div className="flex items-center gap-2 mt-3 animate-fade-in">
              <span className="text-[11px] font-bold text-muted-foreground">Filtrando:</span>
              <button
                onClick={() => setActiveCategory(null)}
                className="tactile inline-flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-full bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wide shadow-coral-sm"
              >
                {categories.find(c => c.id === activeCategory)?.name}
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>

      <PromoBanners
        restaurantId={restaurant.id}
        onCategoryClick={(catId) => {
          setActiveCategory(catId);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onProductClick={(productId) => {
          const p = products.find((pr) => pr.id === productId);
          if (p) handleSelectProduct(p);
        }}
      />

      {/* ============ DISH DISCOVERIES — Categorias em grid 4-col ============ */}
      {categories.length > 0 && !search && (
        <section className="public-container pt-6">
          <div className="flex items-end justify-between mb-3 px-1">
            <h2 className="font-display font-black text-xl leading-tight">Explore o cardápio</h2>
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="text-[11px] font-black uppercase tracking-wider text-primary hover:underline"
              >
                Ver todas
              </button>
            )}
          </div>
          {/* Mobile: one-line touch carousel with larger tiles and full names.
              md+: keeps grid layout. */}
          <div className="md:hidden -mx-4 px-4 flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x-strong">
            {categories.map((c, idx) => {
              const isActive = activeCategory === c.id;
              const emoji = getCategoryEmoji(c.name);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(isActive ? null : c.id)}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`tactile snap-start-always shrink-0 w-[112px] animate-reveal-up rounded-2xl flex flex-col items-center justify-start gap-2 p-2.5 transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-primary-foreground shadow-coral ring-2 ring-primary/40'
                      : 'bg-card ring-1 ring-border/50 shadow-sm hover:ring-primary/30'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center h-16 w-16 rounded-2xl transition-all overflow-hidden ${
                      isActive ? 'bg-primary-foreground/15' : 'bg-[hsl(var(--primary-soft))]'
                    }`}
                  >
                    {(c as any).image_url ? (
                      <img src={(c as any).image_url} alt={c.name} className="h-full w-full object-cover rounded-2xl" />
                    ) : (
                      <span className="text-3xl leading-none">{emoji}</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-extrabold leading-tight text-center break-words hyphens-auto px-0.5 ${
                      isActive ? 'text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tablet/Desktop: grid */}
          <div className="hidden md:grid grid-cols-6 lg:grid-cols-8 gap-3">
            {categories.slice(0, 16).map((c, idx) => {
              const isActive = activeCategory === c.id;
              const emoji = getCategoryEmoji(c.name);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(isActive ? null : c.id)}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`tactile group relative animate-reveal-up rounded-2xl overflow-hidden aspect-square flex flex-col items-center justify-center gap-1.5 p-2 transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-primary-foreground shadow-coral ring-2 ring-primary/40 scale-[0.97]'
                      : 'bg-card ring-1 ring-border/50 shadow-sm hover:shadow-coral-sm hover:-translate-y-0.5 hover:ring-primary/30'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center h-12 w-12 rounded-xl transition-all overflow-hidden ${
                      isActive ? 'bg-primary-foreground/15' : 'bg-[hsl(var(--primary-soft))]'
                    }`}
                  >
                    {(c as any).image_url ? (
                      <img src={(c as any).image_url} alt={c.name} className="h-full w-full object-cover rounded-xl" />
                    ) : (
                      <span className="text-2xl leading-none group-hover:scale-110 transition-transform">{emoji}</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-extrabold leading-tight text-center line-clamp-1 px-0.5 ${
                      isActive ? 'text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>

        </section>
      )}


      {/* ============ FEATURED — Big cards carousel (the "Misto" hero strip) ============ */}
      {featuredProducts.length > 0 && !activeCategory && !search && (
        <section className="public-container pt-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Em alta</span>
              <h2 className="font-display font-black text-2xl leading-tight mt-0.5">Destaques 🔥</h2>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground pb-1">{featuredProducts.length} itens</span>
          </div>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-2 no-scrollbar snap-x-strong">
            {featuredProducts.map((p) => {
              const inCart = cart.find(i => i.product?.id === p.id);
              const hasPromo = !!p.promo_price;
              return (
                <button key={p.id} onClick={() => handleSelectProduct(p)} disabled={isClosed}
                  className={`snap-start-always tactile group relative shrink-0 w-[78vw] max-w-[280px] sm:w-[260px] rounded-3xl overflow-hidden bg-card ring-1 ring-border/40 text-left transition-all hover:ring-primary/40 hover:shadow-tinted-sm ${isClosed ? 'opacity-60' : ''}`}>
                  <div className="relative h-40 overflow-hidden bg-muted">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="h-full w-full flex items-center justify-center text-5xl">🍽️</div>}
                    {hasPromo && (
                      <span className="absolute top-2.5 left-2.5 inline-flex items-center rounded-full bg-primary text-primary-foreground px-2 py-1 text-[10px] font-black uppercase tracking-wider shadow-lg">
                        −{Math.round((1 - Number(p.promo_price)/Number(p.price))*100)}%
                      </span>
                    )}
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-0.5 rounded-full bg-accent/95 backdrop-blur text-accent-foreground px-2 py-1 text-[10px] font-black uppercase tracking-wider shadow-lg">
                      ⭐ TOP
                    </span>
                  </div>
                  <div className="p-3.5 relative">
                    <h3 className="font-display font-black text-base leading-tight line-clamp-1">{p.name}</h3>
                    {p.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 min-h-[28px] leading-snug">{p.description}</p>}
                    <div className="flex items-end justify-between mt-3">
                      <div className="flex flex-col">
                        {hasPromo && <span className="text-[10px] text-muted-foreground line-through leading-none mb-0.5">{formatCurrency(Number(p.price))}</span>}
                        <span className={`font-display font-black text-lg leading-none ${hasPromo ? 'text-primary' : 'text-foreground'}`}>{formatCurrency(Number(p.promo_price || p.price))}</span>
                      </div>
                      <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-tinted-sm group-hover:scale-110 transition-transform">
                        {inCart ? <span className="font-black text-sm">{inCart.qty}</span> : <Plus className="h-4 w-4" strokeWidth={3} />}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ COMBOS — horizontal showcase ============ */}
      {combos.length > 0 && !activeCategory && !search && (
        <section className="public-container pt-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Imperdíveis</span>
              <h2 className="font-display font-black text-2xl leading-tight mt-0.5">Combos da casa</h2>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground pb-1">Economize</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar snap-x-strong">
            {combos.map((c: any) => {
              const itemsSum = (c.product_combo_items || []).reduce((s: number, it: any) => s + Number(it.products?.price || 0) * (it.quantity || 1), 0);
              const save = itemsSum - Number(c.price);
              return (
                <div key={c.id} className="snap-start-always shrink-0 w-[78vw] max-w-[280px] sm:w-[260px] rounded-3xl bg-card ring-1 ring-border/40 overflow-hidden">
                  <div className="relative h-36 bg-gradient-to-br from-accent/20 to-primary/15 flex items-center justify-center text-5xl overflow-hidden">
                    {c.image_url
                      ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                      : '🍔'}
                    {save > 0 && (
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-primary text-primary-foreground px-2 py-1 text-[10px] font-black uppercase shadow-lg">
                        ECONOMIZA {formatCurrency(save)}
                      </span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <h3 className="font-display font-bold text-sm leading-tight truncate">{c.name}</h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">
                      {(c.product_combo_items || []).map((it: any) => `${it.quantity}× ${it.products?.name || ''}`).join(' + ')}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-display font-black text-lg">{formatCurrency(Number(c.price))}</span>
                      <button onClick={() => addComboToCart(c)} disabled={isClosed}
                        className="tactile rounded-full bg-primary text-primary-foreground h-9 w-9 inline-flex items-center justify-center shadow-tinted-sm disabled:opacity-50">
                        <Plus className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ PRODUCTS — Categories list (iFood-style horizontal cards) ============ */}
      <main className="public-container pt-6 pb-40 space-y-8 md:space-y-12">
        {(activeCategory ? [categories.find(c => c.id === activeCategory)!] : categories).map((cat) => {
          if (!cat) return null;
          const catProducts = filteredProducts.filter(p => p.category_id === cat.id);
          if (catProducts.length === 0) return null;
          const emoji = getCategoryEmoji(cat.name);
          return (
            <ScrollReveal key={cat.id}>
              <section>
                {/* Section header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl leading-none shrink-0">{emoji}</span>
                    <h2 className="font-display font-black text-xl leading-tight truncate">{cat.name}</h2>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">{catProducts.length} {catProducts.length === 1 ? 'item' : 'itens'}</span>
                </div>

                <div className="rounded-3xl bg-card ring-1 ring-border/40 overflow-hidden divide-y divide-border/40 md:divide-y-0 md:rounded-none md:bg-transparent md:ring-0 md:grid md:grid-cols-2 md:gap-3">
                  {catProducts.map((p) => {
                    const inCart = cart.find(i => i.product?.id === p.id);
                    const hasPromo = !!p.promo_price;
                    return (
                      <button key={p.id} onClick={() => handleSelectProduct(p)} disabled={isClosed}
                        className={`tactile group w-full text-left p-3 sm:p-3.5 flex gap-3 items-stretch transition-colors hover:bg-muted/40 md:bg-card md:rounded-2xl md:ring-1 md:ring-border/40 md:hover:ring-primary/30 md:hover:shadow-coral-sm ${isClosed ? 'opacity-60' : ''}`}>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-display font-bold text-[15px] sm:text-base leading-tight line-clamp-1">{p.name}</h3>
                            {p.featured && <span className="shrink-0 text-[8px] font-black uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded ring-1 ring-accent/30">⭐ TOP</span>}
                          </div>
                          {p.description && <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{p.description}</p>}
                          <div className="flex items-baseline gap-2 mt-auto pt-2 flex-wrap">
                            {hasPromo && <span className="text-[11px] text-muted-foreground line-through">{formatCurrency(Number(p.price))}</span>}
                            <span className={`font-display font-black text-base sm:text-lg ${hasPromo ? 'text-primary' : 'text-foreground'}`}>{formatCurrency(Number(p.promo_price || p.price))}</span>
                            {hasPromo && <span className="text-[10px] font-black uppercase tracking-wider bg-primary/12 text-primary px-1.5 py-0.5 rounded ring-1 ring-primary/25">−{Math.round((1 - Number(p.promo_price)/Number(p.price))*100)}%</span>}
                          </div>
                        </div>
                        <div className="relative h-[80px] w-[80px] sm:h-[96px] sm:w-[96px] md:h-[104px] md:w-[104px] shrink-0">
                          <div className="h-full w-full rounded-2xl bg-muted flex items-center justify-center text-3xl overflow-hidden ring-1 ring-border/40">
                            {p.image_url
                              ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              : <span>🍽️</span>}
                          </div>
                          {inCart ? (
                            <span className="absolute -top-1.5 -right-1.5 h-7 w-7 rounded-full bg-foreground text-background text-xs font-black flex items-center justify-center ring-2 ring-card shadow-md animate-cart-bump">
                              {inCart.qty}
                            </span>
                          ) : (
                            <span className="absolute -bottom-1.5 -right-1.5 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-card shadow-tinted-sm group-hover:scale-110 transition-all">
                              <Plus className="h-4 w-4" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </ScrollReveal>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-3">🔎</div>
            <p className="font-display font-black text-xl">Nada por aqui</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? `Nenhum item para "${search}"` : 'Esta categoria está vazia no momento'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="tactile mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-black uppercase tracking-wide">
                <X className="h-3.5 w-3.5" /> Limpar busca
              </button>
            )}
          </div>
        )}
      </main>

      {/* Product detail modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => { setSelectedProduct(null); setProductOptions([]); setSelectedOptions([]); }} />
          <div className="relative w-full sm:max-w-md md:max-w-lg lg:max-w-xl bg-card rounded-t-3xl sm:rounded-3xl shadow-xl animate-reveal-up max-h-[94vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-5 pb-8">
              <button onClick={() => { setSelectedProduct(null); setProductOptions([]); setSelectedOptions([]); }} className="absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur-md hover:bg-background transition-colors z-10 shadow-md"><X className="h-4 w-4" /></button>
              <div className="h-64 sm:h-72 -mx-5 -mt-5 mb-4 bg-muted flex items-center justify-center text-6xl overflow-hidden">
                {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" /> : '🍽️'}
              </div>
              <h2 className="font-heading text-xl font-bold">{selectedProduct.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedProduct.description}</p>
              <div className="flex items-baseline gap-2 mt-3">
                {selectedProduct.promo_price && <span className="text-sm text-muted-foreground line-through">{formatCurrency(Number(selectedProduct.price))}</span>}
                <span className="font-heading font-bold text-xl">{formatCurrency(Number(selectedProduct.promo_price || selectedProduct.price))}</span>
              </div>

              {/* Product Options */}
              {loadingOptions && <div className="py-4 text-center text-sm text-muted-foreground">Carregando opções...</div>}
              {productOptions.length > 0 && (
                <div className="mt-4 space-y-4">
                  {productOptions.map((group: any) => (
                    <div key={group.id} className="border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">{group.name}</h4>
                        {group.required && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Obrigatório</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {group.min_selections === group.max_selections
                          ? `Escolha ${group.min_selections}`
                          : `Escolha de ${group.min_selections} a ${group.max_selections}`}
                      </p>
                      <div className="space-y-1.5">
                        {(group.product_options || []).filter((o: any) => o.active).sort((a: any, b: any) => a.sort_order - b.sort_order).map((option: any) => {
                          const isSelected = selectedOptions.some(o => o.optionId === option.id);
                          return (
                            <button key={option.id} onClick={() => toggleOption(group.id, option, group.max_selections)}
                              className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all border ${
                                isSelected ? 'bg-primary/10 border-primary text-foreground' : 'border-border hover:border-primary/40'
                              }`}>
                              <span className="font-medium">{option.name}</span>
                              {Number(option.price) > 0 && <span className="text-xs text-muted-foreground">+{formatCurrency(Number(option.price))}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => addToCart(selectedProduct)}
                className="w-full mt-6 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> Adicionar ao pedido
                {selectedOptions.length > 0 && (
                  <span className="ml-1">({formatCurrency(
                    Number(selectedProduct.promo_price || selectedProduct.price) + selectedOptions.reduce((s, o) => s + o.price, 0)
                  )})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation — sempre visível, estilo app de delivery */}
      <PublicBottomNav
        cartCount={cartCount}
        onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onSearch={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => {
            const el = document.getElementById('public-menu-search') as HTMLInputElement | null;
            el?.focus();
          }, 350);
        }}
        onCart={() => {
          if (cartCount === 0) {
            toast.info('Seu carrinho está vazio. Adicione itens do cardápio.');
            return;
          }
          if (isClosed) {
            toast.error('Estabelecimento fechado no momento.');
            return;
          }
          setCartOpen(true);
        }}
        accountHref={customerUser ? '/cliente' : '/meus-pedidos'}
        accountLabel={customerUser ? 'Conta' : 'Pedidos'}
      />

      {/* Cart / Checkout Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto font-public bg-gradient-to-b from-background via-background to-primary/5 border-t-0">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">🛒</span>
              Finalizar Pedido
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {cart.map(item => {
              const id = itemId(item);
              const lineTotal = (itemUnitPrice(item) + (item.options || []).reduce((s, o) => s + o.price, 0)) * item.qty;
              return (
                <div key={id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => updateQty(id, -1)} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                    <button onClick={() => updateQty(id, 1)} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.combo && <span className="mr-1 inline-flex items-center rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold">COMBO</span>}
                      {itemName(item)}
                    </p>
                    {item.options && item.options.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">{item.options.map(o => o.name).join(', ')}</p>
                    )}
                  </div>
                  <span className="text-sm font-heading font-bold tabular-nums shrink-0">{formatCurrency(lineTotal)}</span>
                </div>
              );
            })}
          </div>

          {/* Order type in checkout if both available */}
          {deliveryEnabled && pickupEnabled && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium mb-2">Tipo de pedido</p>
              <div className="flex gap-2">
                <button onClick={() => setOrderType('delivery')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all border ${
                    effectiveOrderType === 'delivery' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  <Truck className="h-4 w-4" /> Entrega
                </button>
                <button onClick={() => setOrderType('pickup')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all border ${
                    effectiveOrderType === 'pickup' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  <Store className="h-4 w-4" /> Retirada
                </button>
              </div>
            </div>
          )}

          {/* Login gate banner (iFood-style) */}
          {!customerUser && (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Entre para finalizar o pedido</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Acompanhe o status, salve endereços e veja seu histórico em "Minha Conta".
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => saveDraftAndGoLogin('login')}
                      className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all">
                      Entrar
                    </button>
                    <button onClick={() => saveDraftAndGoLogin('register')}
                      className="flex-1 rounded-lg border border-primary/40 bg-background px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 active:scale-[0.97] transition-all">
                      Criar conta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customer info */}
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Seus dados</p>
              {customerUser && (
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> {customerUser.email}
                </span>
              )}
            </div>
            <input type="text" placeholder="Seu nome *" value={customerName} onChange={e => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
            <input type="tel" placeholder="Telefone com DDD *" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
            {effectiveOrderType === 'delivery' && zones.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bairro de entrega *</label>
                <select value={selectedZoneId || ''} onChange={e => setSelectedZoneId(e.target.value || null)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all">
                  <option value="">Selecione o bairro...</option>
                  {zones.map((z: any) => (
                    <option key={z.id} value={z.id}>
                      {z.neighborhood}{z.city ? ` — ${z.city}` : ''} · Taxa {formatCurrency(Number(z.delivery_fee))} · {z.estimated_time}min
                    </option>
                  ))}
                </select>
                {!selectedZoneId && (
                  <p className="text-[11px] text-muted-foreground mt-1">Selecione seu bairro para calcular a taxa correta.</p>
                )}
              </div>
            )}
            {effectiveOrderType === 'delivery' && (
              <div className="space-y-2">
                {savedAddresses.length > 0 ? (
                  <div>
                    <button onClick={() => setShowAddressPicker(!showAddressPicker)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-left flex items-center justify-between hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className={`truncate ${address ? 'text-foreground' : 'text-muted-foreground'}`}>{address || 'Selecione um endereço'}</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${showAddressPicker ? 'rotate-180' : ''}`} />
                    </button>
                    {showAddressPicker && (
                      <div className="mt-1 border border-border rounded-xl bg-card overflow-hidden">
                        {savedAddresses.map((addr: any) => {
                          const parts = [addr.street, addr.number, addr.complement, addr.neighborhood, addr.city, addr.state].filter(Boolean);
                          const formatted = parts.join(', ');
                          return (
                            <button key={addr.id} onClick={() => { setAddress(formatted); setShowAddressPicker(false); }}
                              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 border-b border-border last:border-0 ${address === formatted ? 'bg-primary/5 text-primary' : ''}`}>
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-medium text-xs">{addr.label || 'Endereço'}{addr.is_default ? ' ★' : ''}</span>
                                <p className="text-xs text-muted-foreground truncate">{formatted}</p>
                              </div>
                            </button>
                          );
                        })}
                        <button onClick={() => { setAddress(''); setShowAddressPicker(false); }}
                          className="w-full text-left px-3 py-2.5 text-xs text-primary hover:bg-muted transition-colors flex items-center gap-2">
                          <Plus className="h-3.5 w-3.5" /> Digitar outro endereço
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input type="text" placeholder="Endereço completo *" value={address} onChange={e => setAddress(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
                )}
              </div>
            )}
            <textarea placeholder="Observações (opcional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
          </div>

          {/* Payment method */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm font-medium mb-1">
              Como você vai pagar {effectiveOrderType === 'delivery' ? 'na entrega' : effectiveOrderType === 'pickup' ? 'na retirada' : 'ao receber'}?
            </p>
            <p className="text-[11px] text-muted-foreground mb-2">
              💵 O pagamento é feito <strong>diretamente ao estabelecimento</strong> — a plataforma não cobra nem processa valores.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {availablePayments.map(pm => {
                const Icon = pm.icon;
                return (
                  <button key={pm.key} onClick={() => setPaymentMethod(pm.key)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border ${
                      paymentMethod === pm.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                    }`}>
                    <Icon className="h-4 w-4" />
                    {pm.label}
                  </button>
                );
              })}
            </div>

            {paymentMethod === 'cash' && (
              <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-sm font-medium">Precisa de troco?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setNeedsChange('no'); setChangeFor(''); }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium border transition-all ${
                      needsChange === 'no' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    Não preciso
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedsChange('yes')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium border transition-all ${
                      needsChange === 'yes' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    Sim, troco para:
                  </button>
                </div>
                {needsChange === 'yes' && (
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min={grandTotal}
                      inputMode="decimal"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      placeholder={`Ex.: ${(Math.ceil(grandTotal / 10) * 10).toFixed(2)}`}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    {changeFor && parseFloat(changeFor.replace(',', '.')) >= grandTotal && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Levaremos troco de <strong>{formatCurrency(parseFloat(changeFor.replace(',', '.')) - grandTotal)}</strong>
                      </p>
                    )}
                    {changeFor && parseFloat(changeFor.replace(',', '.')) < grandTotal && (
                      <p className="text-[11px] text-destructive mt-1">
                        O valor deve ser maior que {formatCurrency(grandTotal)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-border mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span><span className="tabular-nums">{formatCurrency(cartTotal)}</span>
            </div>
            {effectiveOrderType === 'delivery' && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Taxa de entrega</span><span className="tabular-nums">{deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Grátis'}</span>
              </div>
            )}
            {minOrderValue > 0 && cartTotal < minOrderValue && (
              <p className="text-xs text-destructive">Pedido mínimo: {formatCurrency(minOrderValue)}</p>
            )}
            <div className="flex justify-between font-heading font-bold text-lg pt-1">
              <span>Total</span><span className="tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <button onClick={handleSubmitOrder} disabled={submitting || (!!customerUser && !canSubmit())}
            className="w-full mt-5 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting
              ? 'Enviando...'
              : !customerUser
                ? 'Entrar e finalizar pedido'
                : effectiveOrderType === 'pickup' ? 'Confirmar Retirada' : 'Confirmar Pedido'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
