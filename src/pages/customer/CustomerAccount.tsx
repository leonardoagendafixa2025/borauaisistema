import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, MapPin, Clock, ShoppingBag, LogOut, Plus, Trash2, Star, ChevronRight, Truck, UtensilsCrossed, Package, Edit2, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CustomerTelegramLink from '@/components/customer/CustomerTelegramLink';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabels: Record<string, { label: string; class: string }> = {
  new: { label: 'Novo', class: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Aceito', class: 'bg-sky-100 text-sky-700' },
  preparing: { label: 'Em preparo', class: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Pronto', class: 'bg-emerald-100 text-emerald-700' },
  delivering: { label: 'Em entrega', class: 'bg-purple-100 text-purple-700' },
  waiting_pickup: { label: 'Aguardando', class: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Concluído', class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', class: 'bg-red-100 text-red-700' },
};

const typeIcons: Record<string, typeof Truck> = {
  delivery: Truck,
  pickup: ShoppingBag,
  dine_in: UtensilsCrossed,
};

export default function CustomerAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, loading, signOut, refetchProfile } = useCustomerAuth();
  const [tab, setTab] = useState<'orders' | 'addresses' | 'profile'>('orders');

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) navigate('/cliente/login', { replace: true });
  }, [loading, user, navigate]);

  // Get customer records for this user (may be in multiple restaurants)
  const { data: customers = [] } = useQuery({
    queryKey: ['my-customers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('customers').select('id, restaurant_id').eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const customerIds = customers.map(c => c.id);

  // Orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['my-orders', customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*), restaurants(name, slug, logo_url)')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: customerIds.length > 0,
  });

  // Addresses
  const { data: addresses = [], isLoading: loadingAddresses } = useQuery({
    queryKey: ['my-addresses', customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .in('customer_id', customerIds)
        .order('is_default', { ascending: false });
      return data || [];
    },
    enabled: customerIds.length > 0,
  });

  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({ label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' });
  const [savingAddr, setSavingAddr] = useState(false);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });

  useEffect(() => {
    if (profile) {
      setProfileForm({ name: profile.name, phone: profile.phone || '' });
    }
  }, [profile]);

  const handleSaveAddress = async () => {
    if (!addrForm.street.trim() || !addrForm.city.trim()) { toast.error('Preencha rua e cidade'); return; }
    const customerId = customerIds[0]; // Use first customer
    if (!customerId) { toast.error('Faça um pedido primeiro para salvar endereços'); return; }
    setSavingAddr(true);
    try {
      if (editingAddressId) {
        await supabase.from('addresses').update({
          label: addrForm.label || 'Casa',
          street: addrForm.street, number: addrForm.number || null, complement: addrForm.complement || null,
          neighborhood: addrForm.neighborhood || null, city: addrForm.city, state: addrForm.state || null, zip_code: addrForm.zip_code || null,
        }).eq('id', editingAddressId);
        toast.success('Endereço atualizado');
      } else {
        await supabase.from('addresses').insert({
          customer_id: customerId,
          label: addrForm.label || 'Casa',
          street: addrForm.street, number: addrForm.number || null, complement: addrForm.complement || null,
          neighborhood: addrForm.neighborhood || null, city: addrForm.city, state: addrForm.state || null, zip_code: addrForm.zip_code || null,
          is_default: addresses.length === 0,
        });
        toast.success('Endereço salvo');
      }
      queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      setShowAddressForm(false);
      setEditingAddressId(null);
      setAddrForm({ label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' });
    } catch { toast.error('Erro ao salvar endereço'); }
    setSavingAddr(false);
  };

  const handleDeleteAddress = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
    toast.success('Endereço removido');
  };

  const handleSetDefault = async (id: string) => {
    // Remove default from all, set on this one
    for (const addr of addresses) {
      if (addr.is_default) await supabase.from('addresses').update({ is_default: false }).eq('id', addr.id);
    }
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
    toast.success('Endereço padrão atualizado');
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    // Update all customer records
    for (const c of customers) {
      await supabase.from('customers').update({
        name: profileForm.name.trim(),
        phone: profileForm.phone.replace(/\D/g, '') || null,
      }).eq('id', c.id);
    }
    // Update auth metadata
    await supabase.auth.updateUser({ data: { full_name: profileForm.name.trim() } });
    refetchProfile();
    setEditingProfile(false);
    toast.success('Perfil atualizado');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleReorder = async (order: any) => {
    const restaurant = order.restaurants;
    if (!restaurant?.slug || !restaurant?.id) {
      toast.error('Restaurante indisponível');
      return;
    }
    const items = order.order_items || [];
    if (items.length === 0) {
      toast.error('Pedido sem itens para repetir');
      return;
    }

    try {
      // Fetch current active products to rebuild cart with up-to-date prices/availability
      const productIds = items.map((i: any) => i.product_id).filter(Boolean);
      const { data: currentProducts } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('active', true);

      const productMap = new Map((currentProducts || []).map((p: any) => [p.id, p]));

      const cart = items
        .map((item: any) => {
          const product = productMap.get(item.product_id);
          if (!product || product.sold_out) return null;
          return {
            product,
            qty: item.qty,
            notes: item.notes || '',
            options: item.options || [],
          };
        })
        .filter(Boolean);

      if (cart.length === 0) {
        toast.error('Nenhum item deste pedido está disponível no momento');
        return;
      }

      const draft: any = {
        cart,
        orderType: order.type === 'pickup' ? 'pickup' : 'delivery',
        address: order.address || '',
        paymentMethod: order.payment_method || null,
        notes: order.notes || '',
      };

      sessionStorage.setItem(`checkout_draft_${restaurant.id}`, JSON.stringify(draft));

      const skipped = items.length - cart.length;
      if (skipped > 0) {
        toast.success(`${cart.length} ite${cart.length === 1 ? 'm' : 'ns'} adicionado${cart.length === 1 ? '' : 's'} (${skipped} indisponíve${skipped === 1 ? 'l' : 'is'})`);
      } else {
        toast.success('Pedido carregado no carrinho');
      }

      navigate(`/${restaurant.slug}`);
    } catch (e) {
      toast.error('Erro ao repetir pedido');
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return `Hoje ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatAddress = (a: any) => {
    const parts = [a.street, a.number, a.complement, a.neighborhood, a.city, a.state].filter(Boolean);
    return parts.join(', ');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const tabs = [
    { key: 'orders' as const, label: 'Pedidos', icon: Clock },
    { key: 'addresses' as const, label: 'Endereços', icon: MapPin },
    { key: 'profile' as const, label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="h-5 w-5" /></Link>
            <div>
              <h1 className="font-heading font-bold text-xl">Minha Conta</h1>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === t.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {tab === 'orders' && (
          <div className="space-y-3">
            {loadingOrders && <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>}

            {/* Highlight: Último pedido em andamento */}
            {!loadingOrders && orders.length > 0 && (() => {
              const latest = orders[0] as any;
              const isActive = !['completed', 'cancelled'].includes(latest.status);
              const status = statusLabels[latest.status] || { label: latest.status, class: 'bg-muted text-muted-foreground' };
              const TypeIcon = typeIcons[latest.type] || Package;
              const restaurant = latest.restaurants as any;
              return (
                <div className="space-y-2">
                  <Link to={`/pedido/${latest.id}`}
                    className="block relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 shadow-lg hover:shadow-xl transition-all active:scale-[0.99]">
                    <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                          {isActive ? '🔥 Pedido em andamento' : 'Último pedido'}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">{status.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                          <TypeIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading font-bold text-lg leading-tight">Pedido #{latest.number}</p>
                          {restaurant && <p className="text-sm opacity-90 truncate">{restaurant.name}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-heading font-bold text-lg">{fmt(Number(latest.total))}</p>
                          <p className="text-[10px] opacity-80">{formatDate(latest.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-white/15 backdrop-blur rounded-xl px-3 py-2">
                        <span className="text-sm font-medium">{isActive ? 'Acompanhar pedido' : 'Ver detalhes'}</span>
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    </div>
                  </Link>
                  {!isActive && restaurant?.slug && (
                    <button onClick={() => handleReorder(latest)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-card border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary font-semibold text-sm transition-all active:scale-[0.99]">
                      <RefreshCw className="h-4 w-4" /> Repetir pedido
                    </button>
                  )}
                </div>
              );
            })()}

            {!loadingOrders && orders.length > 1 && (
              <div className="pt-2 pb-1">
                <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">Histórico</h2>
              </div>
            )}

            {!loadingOrders && orders.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum pedido ainda</p>
                <p className="text-sm text-muted-foreground mt-1">Seus pedidos aparecerão aqui</p>
              </div>
            )}
            {orders.slice(1).map(order => {
              const status = statusLabels[order.status] || { label: order.status, class: 'bg-muted text-muted-foreground' };
              const TypeIcon = typeIcons[order.type] || Package;
              const restaurant = order.restaurants as any;
              const itemsSummary = (order.order_items || []).slice(0, 3).map((i: any) => `${i.qty}x ${i.name}`).join(', ');

              return (
                <Link key={order.id} to={`/pedido/${order.id}`}
                  className="card-elevated p-4 flex gap-3 hover:shadow-md transition-all active:scale-[0.99] block">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <TypeIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-heading font-bold text-sm">#{order.number}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.class}`}>{status.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    {restaurant && <p className="text-xs font-medium text-foreground/80 mt-0.5">{restaurant.name}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{itemsSummary}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                      <span className="font-heading font-bold text-sm">{fmt(Number(order.total))}</span>
                    </div>

                    {/* Reorder button for completed orders */}
                    {order.status === 'completed' && restaurant?.slug && (
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); handleReorder(order); }}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                        <RefreshCw className="h-3.5 w-3.5" /> Repetir pedido
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ADDRESSES TAB */}
        {tab === 'addresses' && (
          <div className="space-y-3">
            <button onClick={() => { setShowAddressForm(true); setEditingAddressId(null); setAddrForm({ label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' }); }}
              className="w-full card-elevated p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.99] border-2 border-dashed border-border">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Plus className="h-5 w-5 text-primary" /></div>
              <span className="text-sm font-medium">Adicionar endereço</span>
            </button>

            {loadingAddresses && <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>}

            {addresses.map(addr => (
              <div key={addr.id} className="card-elevated p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{addr.label || 'Endereço'}</span>
                      {addr.is_default && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Padrão</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatAddress(addr)}</p>
                    {addr.zip_code && <p className="text-xs text-muted-foreground">CEP: {addr.zip_code}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!addr.is_default && (
                      <button onClick={() => handleSetDefault(addr.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary" title="Definir como padrão">
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => {
                      setEditingAddressId(addr.id);
                      setAddrForm({ label: addr.label || 'Casa', street: addr.street, number: addr.number || '', complement: addr.complement || '', neighborhood: addr.neighborhood || '', city: addr.city, state: addr.state || '', zip_code: addr.zip_code || '' });
                      setShowAddressForm(true);
                    }} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteAddress(addr.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!loadingAddresses && addresses.length === 0 && !showAddressForm && (
              <div className="text-center py-8">
                <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum endereço salvo</p>
              </div>
            )}

            {/* Address form */}
            {showAddressForm && (
              <div className="card-elevated p-4 space-y-3">
                <h3 className="font-heading font-semibold text-sm">{editingAddressId ? 'Editar endereço' : 'Novo endereço'}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {['Casa', 'Trabalho', 'Outro'].map(l => (
                    <button key={l} onClick={() => setAddrForm(f => ({ ...f, label: l }))}
                      className={`rounded-lg py-2 text-xs font-medium border transition-all ${addrForm.label === l ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Rua *" value={addrForm.street} onChange={e => setAddrForm(f => ({ ...f, street: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Número" value={addrForm.number} onChange={e => setAddrForm(f => ({ ...f, number: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
                  <input type="text" placeholder="Complemento" value={addrForm.complement} onChange={e => setAddrForm(f => ({ ...f, complement: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
                </div>
                <input type="text" placeholder="Bairro" value={addrForm.neighborhood} onChange={e => setAddrForm(f => ({ ...f, neighborhood: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="Cidade *" value={addrForm.city} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))}
                    className="col-span-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
                  <input type="text" placeholder="UF" value={addrForm.state} onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} maxLength={2}
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
                </div>
                <input type="text" placeholder="CEP" value={addrForm.zip_code} onChange={e => setAddrForm(f => ({ ...f, zip_code: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddressForm(false); setEditingAddressId(null); }}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-all">Cancelar</button>
                  <button onClick={handleSaveAddress} disabled={savingAddr}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Check className="h-4 w-4" /> {savingAddr ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold">Dados pessoais</h3>
                {!editingProfile && (
                  <button onClick={() => setEditingProfile(true)} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    <Edit2 className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
              </div>

              {editingProfile ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <input type="text" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefone</label>
                    <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all mt-1" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingProfile(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-all">Cancelar</button>
                    <button onClick={handleSaveProfile} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">Salvar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="text-sm font-medium">{profile?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{profile?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium">{profile?.phone || '—'}</p>
                  </div>
                </div>
              )}
            </div>


            {/* Telegram link */}
            <CustomerTelegramLink customerIds={customerIds} />

            {/* Stats */}
            <div className="card-elevated p-5">
              <h3 className="font-heading font-semibold mb-3">Resumo</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="font-heading font-bold text-lg">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                </div>
                <div>
                  <p className="font-heading font-bold text-lg">{addresses.length}</p>
                  <p className="text-xs text-muted-foreground">Endereços</p>
                </div>
                <div>
                  <p className="font-heading font-bold text-lg">{fmt(orders.reduce((s, o) => s + Number(o.total), 0))}</p>
                  <p className="text-xs text-muted-foreground">Total gasto</p>
                </div>
              </div>
            </div>

            <button onClick={handleLogout}
              className="w-full rounded-xl border border-destructive/30 text-destructive py-3 text-sm font-medium hover:bg-destructive/5 transition-all flex items-center justify-center gap-2">
              <LogOut className="h-4 w-4" /> Sair da conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
