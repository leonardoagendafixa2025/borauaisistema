import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ExternalLink, MoreHorizontal, Building2, Loader2, Edit2, RefreshCw, Ban, Trash2, CheckCircle, AlertTriangle, Copy, Check, LogIn, ChevronLeft, ChevronRight, Store, MapPin, CreditCard, User } from 'lucide-react';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useMasterRestaurants } from '@/hooks/useRestaurantData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { createNotification } from '@/hooks/useNotifications';
import SuspendRestaurantDialog from '@/components/master/SuspendRestaurantDialog';

const statusLabels: Record<string, { label: string; class: string }> = {
  active: { label: 'Ativo', class: 'bg-success/10 text-success' },
  trial: { label: 'Trial', class: 'bg-primary/10 text-primary' },
  overdue: { label: 'Inadimplente', class: 'bg-destructive/10 text-destructive' },
  suspended: { label: 'Suspenso', class: 'bg-warning/10 text-warning' },
  cancelled: { label: 'Cancelado', class: 'bg-muted text-muted-foreground' },
};

const emptyForm = {
  name: '', slug: '', email: '', phone: '', whatsapp: '', cnpj: '',
  address: '', city: '', state: '', zip_code: '',
  plan_id: '', owner_email: '', owner_name: '', owner_password: '',
  status: 'trial' as const,
};

const inputClass = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all";

export default function RestaurantList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { data: restaurants = [], isLoading } = useMasterRestaurants();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Edit modal
  const [editRestaurant, setEditRestaurant] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerNewEmail, setOwnerNewEmail] = useState('');
  const [ownerNewPassword, setOwnerNewPassword] = useState('');
  const [credentialsSaving, setCredentialsSaving] = useState(false);

  // Change plan modal
  const [planRestaurant, setPlanRestaurant] = useState<any>(null);
  const [newPlanId, setNewPlanId] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  // Delete confirm modal
  const [deleteRestaurant, setDeleteRestaurant] = useState<any>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Credentials modal
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string; loginUrl: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Suspend/Reactivate dialog
  const [suspendTarget, setSuspendTarget] = useState<{ restaurant: any; mode: 'suspend' | 'reactivate' } | null>(null);

  // Impersonate
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('subscription_plans').select('*').eq('active', true).order('price');
      return data || [];
    },
  });

  const filtered = restaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || (r.city || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['master-restaurants'] });
    queryClient.invalidateQueries({ queryKey: ['master-metrics'] });
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'name' && !prev.slug) {
        updated.slug = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      return updated;
    });
  };

  // CREATE
  const handleCreate = async () => {
    if (!form.name || !form.slug) { toast.error('Nome e slug são obrigatórios'); return; }
    setSaving(true);
    try {
      // 1. Insert restaurant first (as admin)
      const { data: restaurant, error: restError } = await supabase.from('restaurants').insert({
        name: form.name, slug: form.slug, email: form.email || null, phone: form.phone || null,
        whatsapp: form.whatsapp || null, cnpj: form.cnpj || null, address: form.address || null,
        city: form.city || null, state: form.state || null, zip_code: form.zip_code || null,
        status: form.status, owner_id: null,
      }).select().single();
      if (restError) throw restError;

      // 2. Insert settings & subscription (still as admin)
      await supabase.from('restaurant_settings').insert({ restaurant_id: restaurant.id });
      if (form.plan_id) {
        const plan = plans.find(p => p.id === form.plan_id);
        const { error: subErr } = await supabase.from('subscriptions').insert({
          restaurant_id: restaurant.id, plan_id: form.plan_id,
          status: form.status === 'trial' ? 'trial' : 'active',
          monthly_price: plan?.price || 0,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          trial_ends_at: form.status === 'trial' ? new Date(Date.now() + 14 * 86400000).toISOString() : null,
        });
        if (subErr) {
          try {
            await fetch('/api/create-checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ priceId: form.plan_id, restaurantId: restaurant.id }),
            });
          } catch (apiErr) {
            console.warn('[RestaurantList] Subscription fallback error:', apiErr);
          }
        }
      }

      // 3. Create owner account LAST (signUp switches session)
      let ownerId: string | null = null;
      if (form.owner_email && form.owner_password) {
        // Save current admin session
        const { data: adminSession } = await supabase.auth.getSession();

        // 1. Primary: create or get user via admin service API (avoids email rate limits and preserves admin session)
        try {
          const res = await fetch('/api/admin-update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create-user',
              email: form.owner_email,
              password: form.owner_password,
              full_name: form.owner_name || form.name,
            }),
          });
          const resJson = await res.json();
          if (res.ok && resJson?.user?.id) {
            ownerId = resJson.user.id;
          }
        } catch (apiEx) {
          console.warn('[RestaurantList] Admin API user creation notice:', apiEx);
        }

        // 2. Secondary: try Supabase Edge Function
        if (!ownerId) {
          try {
            const { data: fnData } = await supabase.functions.invoke('admin-update-user', {
              body: {
                action: 'create-user',
                email: form.owner_email,
                password: form.owner_password,
                full_name: form.owner_name || form.name,
              },
            });
            if (fnData?.user?.id) {
              ownerId = fnData.user.id;
            }
          } catch (fnEx) {
            console.warn('[RestaurantList] Edge function user creation notice:', fnEx);
          }
        }

        // 3. Fallback: try client-side signUp
        if (!ownerId) {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: form.owner_email,
            password: form.owner_password,
            options: { data: { full_name: form.owner_name || form.name } },
          });

          if (authError) {
            // Check if user already exists
            const { data: fnData } = await supabase.functions.invoke('admin-update-user', {
              body: { action: 'get-by-email', email: form.owner_email },
            });
            if (fnData?.user?.id) {
              ownerId = fnData.user.id;
            } else {
              toast.warning('Usuário não pôde ser criado automaticamente. Se necessário, vincule manualmente.');
            }
          } else {
            ownerId = authData?.user?.id || null;
          }
        }

        // Restore admin session immediately
        if (adminSession?.session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: adminSession.session.access_token,
            refresh_token: adminSession.session.refresh_token,
          });
        }

        // Now update restaurant with owner and create role (as admin again)
        if (ownerId) {
          await supabase.from('restaurants').update({ owner_id: ownerId }).eq('id', restaurant.id);
          await supabase.from('user_roles').insert({ user_id: ownerId, role: 'owner', restaurant_id: restaurant.id });
        }
      }

      // Create notification for admin
      if (user?.id) {
        await createNotification({
          user_id: user.id,
          type: 'new_restaurant',
          title: `Novo restaurante: ${form.name}`,
          message: `Restaurante "${form.name}" criado com sucesso no plano ${plans.find(p => p.id === form.plan_id)?.name || 'sem plano'}.`,
          link: '/master/restaurants',
          restaurant_id: restaurant.id,
        });
      }

      invalidate();
      toast.success(`Restaurante "${form.name}" criado!`);
      setShowAdd(false);
      setWizardStep(1);
      if (form.owner_email && form.owner_password) {
        setCreatedCredentials({
          name: form.name,
          email: form.owner_email,
          password: form.owner_password,
          loginUrl: `${window.location.origin}/restaurant/login`,
        });
      }
      setForm(emptyForm);
    } catch (err: any) { toast.error(err.message || 'Erro ao criar'); }
    finally { setSaving(false); }
  };

  // EDIT
  const openEdit = async (r: any) => {
    setEditForm({ name: r.name, slug: r.slug, email: r.email || '', phone: r.phone || '', whatsapp: r.whatsapp || '', cnpj: r.cnpj || '', address: r.address || '', city: r.city || '', state: r.state || '', zip_code: r.zip_code || '', telegram_chat_id: '' });
    // Load telegram_chat_id
    supabase.from('restaurant_settings').select('telegram_chat_id').eq('restaurant_id', r.id).single().then(({ data }) => {
      if (data) setEditForm((p: any) => ({ ...p, telegram_chat_id: (data as any).telegram_chat_id || '' }));
    });
    setOwnerNewEmail('');
    setOwnerNewPassword('');
    // Load owner email from profiles/auth
    if (r.owner_id) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', r.owner_id).maybeSingle();
      // We can get the email from user_roles or the restaurant email
      setOwnerEmail(r.email || '(vinculado, sem e-mail visível)');
      // Try to find via user_roles
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('restaurant_id', r.id).eq('role', 'owner');
      if (roles && roles.length > 0) {
        setOwnerEmail(r.email || `owner_id: ${r.owner_id}`);
      }
    } else {
      setOwnerEmail('');
    }
    setEditRestaurant(r);
  };

  // UPDATE OWNER CREDENTIALS
  const handleUpdateCredentials = async () => {
    if (!editRestaurant?.owner_id) { toast.error('Este restaurante não tem proprietário vinculado'); return; }
    if (!ownerNewEmail && !ownerNewPassword) { toast.error('Informe o novo e-mail ou nova senha'); return; }
    setCredentialsSaving(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ynxrtjvyeymbiifehenk.supabase.co";
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          user_id: editRestaurant.owner_id,
          email: ownerNewEmail || undefined,
          password: ownerNewPassword || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao atualizar credenciais');
      toast.success('Credenciais do proprietário atualizadas!');
      setOwnerNewEmail('');
      setOwnerNewPassword('');
      if (ownerNewEmail) setOwnerEmail(ownerNewEmail);
    } catch (err: any) { toast.error(err.message); }
    finally { setCredentialsSaving(false); }
  };

  const handleEdit = async () => {
    if (!editRestaurant) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from('restaurants').update({
        name: editForm.name, slug: editForm.slug, email: editForm.email || null,
        phone: editForm.phone || null, whatsapp: editForm.whatsapp || null,
        cnpj: editForm.cnpj || null, address: editForm.address || null,
        city: editForm.city || null, state: editForm.state || null, zip_code: editForm.zip_code || null,
      }).eq('id', editRestaurant.id);
      if (error) throw error;
      // Save telegram_chat_id to settings
      await supabase.from('restaurant_settings').update({
        telegram_chat_id: editForm.telegram_chat_id || null,
      } as any).eq('restaurant_id', editRestaurant.id);
      invalidate();
      toast.success('Restaurante atualizado!');
      setEditRestaurant(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setEditSaving(false); }
  };

  // CHANGE PLAN
  const openChangePlan = (r: any) => {
    const sub = (r.subscriptions as any)?.[0];
    setNewPlanId(sub?.plan_id || '');
    setPlanRestaurant(r);
  };
  const handleChangePlan = async () => {
    if (!planRestaurant || !newPlanId) return;
    setPlanSaving(true);
    try {
      const plan = plans.find(p => p.id === newPlanId);
      const sub = (planRestaurant.subscriptions as any)?.[0];
      if (sub) {
        const { error } = await supabase.from('subscriptions').update({
          plan_id: newPlanId, monthly_price: plan?.price || 0,
        }).eq('id', sub.id);
        if (error) {
          const resp = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceId: newPlanId, restaurantId: planRestaurant.id }),
          });
          if (!resp.ok) throw error;
        }
      } else {
        const { error } = await supabase.from('subscriptions').insert({
          restaurant_id: planRestaurant.id, plan_id: newPlanId,
          status: 'active', monthly_price: plan?.price || 0,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
        if (error) {
          const resp = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceId: newPlanId, restaurantId: planRestaurant.id }),
          });
          if (!resp.ok) throw error;
        }
      }
      invalidate();
      toast.success(`Plano alterado para ${plan?.name}!`);
      setPlanRestaurant(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setPlanSaving(false); }
  };

  // OPEN SUSPEND/REACTIVATE DIALOG
  const openSuspendDialog = (r: any) => {
    setSuspendTarget({ restaurant: r, mode: r.status === 'suspended' ? 'reactivate' : 'suspend' });
  };

  // IMPERSONATE — abre painel do dono em nova aba via magic link
  const handleImpersonate = async (r: any) => {
    if (!r.owner_id) {
      toast.error('Restaurante sem proprietário vinculado');
      return;
    }
    setImpersonating(r.id);
    try {
      const { data, error } = await supabase.functions.invoke('master-impersonate', {
        body: { restaurant_id: r.id, reason: 'Suporte master admin' },
      });
      if (error) throw error;
      if (!data?.magic_link) throw new Error('Magic link não retornado');
      window.open(data.magic_link, '_blank');
      toast.success(`Abrindo painel de ${r.name} em nova aba...`);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao gerar acesso');
    } finally {
      setImpersonating(null);
    }
  };

  // DELETE
  const handleDelete = async () => {
    if (!deleteRestaurant) return;
    setDeleteSaving(true);
    try {
      const rid = deleteRestaurant.id;
      // First delete order items
      const { data: orders } = await supabase.from('orders').select('id').eq('restaurant_id', rid);
      if (orders && orders.length > 0) {
        for (const o of orders) {
          await supabase.from('order_items').delete().eq('order_id', o.id);
        }
      }
      await supabase.from('orders').delete().eq('restaurant_id', rid);

      // Delete product options (via product option groups via products)
      const { data: prods } = await supabase.from('products').select('id').eq('restaurant_id', rid);
      if (prods && prods.length > 0) {
        const prodIds = prods.map(p => p.id);
        const { data: groups } = await supabase.from('product_option_groups').select('id').in('product_id', prodIds);
        if (groups && groups.length > 0) {
          const groupIds = groups.map(g => g.id);
          await supabase.from('product_options').delete().in('group_id', groupIds);
          await supabase.from('product_option_groups').delete().in('id', groupIds);
        }
        await supabase.from('products').delete().eq('restaurant_id', rid);
      }

      // Delete remaining dependent tables
      await supabase.from('financial_transactions').delete().eq('restaurant_id', rid);
      await supabase.from('waiter_calls').delete().eq('restaurant_id', rid);
      await supabase.from('coupons').delete().eq('restaurant_id', rid);
      await supabase.from('categories').delete().eq('restaurant_id', rid);
      // Delete addresses before customers (FK: addresses.customer_id -> customers.id)
      const { data: custs } = await supabase.from('customers').select('id').eq('restaurant_id', rid);
      if (custs && custs.length > 0) {
        const custIds = custs.map(c => c.id);
        await supabase.from('addresses').delete().in('customer_id', custIds);
      }
      await supabase.from('customers').delete().eq('restaurant_id', rid);
      await supabase.from('restaurant_tables').delete().eq('restaurant_id', rid);
      await supabase.from('subscriptions').delete().eq('restaurant_id', rid);
      await supabase.from('restaurant_settings').delete().eq('restaurant_id', rid);
      await supabase.from('notifications').delete().eq('restaurant_id', rid);

      // Delete owner auth account if exists
      const ownerId = deleteRestaurant.owner_id;
      // Delete user_roles for this restaurant
      const { data: roleUsers } = await supabase.from('user_roles').select('user_id').eq('restaurant_id', rid);
      await supabase.from('user_roles').delete().eq('restaurant_id', rid);

      // Delete auth users that were staff of this restaurant (and have no other roles)
      if (roleUsers && roleUsers.length > 0) {
        for (const ru of roleUsers) {
          const { data: otherRoles } = await supabase.from('user_roles').select('id').eq('user_id', ru.user_id);
          if (!otherRoles || otherRoles.length === 0) {
            // No other roles - safe to delete user entirely
            await supabase.from('profiles').delete().eq('user_id', ru.user_id);
            await supabase.from('notifications').delete().eq('user_id', ru.user_id);
            await supabase.functions.invoke('admin-update-user', {
              body: { action: 'delete-user', user_id: ru.user_id },
            });
          }
        }
      }

      // Finally delete restaurant
      const { error } = await supabase.from('restaurants').delete().eq('id', rid);
      if (error) throw error;
      
      invalidate();
      toast.success(`"${deleteRestaurant.name}" excluído!`);
      setDeleteRestaurant(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleteSaving(false); }
  };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold">Restaurantes</h1>
              <p className="text-sm text-muted-foreground">{restaurants.length} restaurantes cadastrados</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all self-start">
              <Plus className="h-4 w-4" /> Novo restaurante
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar restaurante..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all">
              <option value="all">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="trial">Trial</option>
              <option value="overdue">Inadimplente</option>
              <option value="suspended">Suspenso</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </ScrollReveal>

        {isLoading ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhum restaurante encontrado</p>
          </div>
        ) : (
          <ScrollReveal delay={120}>
            <div className="grid gap-4">
              {filtered.map(r => {
                const s = statusLabels[r.status] || statusLabels.active;
                const sub = (r.subscriptions as any)?.[0];
                const plan = sub?.subscription_plans;
                const isSuspended = r.status === 'suspended';
                return (
                  <div key={r.id} className="card-elevated-hover p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="font-heading font-bold text-primary">{r.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-heading font-semibold">{r.name}</h3>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.class}`}>{s.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{r.city} · /{r.slug}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span>Plano: <span className="font-medium text-foreground">{plan?.name || '—'}</span></span>
                            {sub && <span>R$ {Number(sub.monthly_price).toFixed(2)}/mês</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link to={`/${r.slug}`} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Ver cardápio">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => handleImpersonate(r)} disabled={impersonating === r.id || !r.owner_id}>
                              {impersonating === r.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                              Entrar como dono
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(r)}>
                              <Edit2 className="h-4 w-4 mr-2" /> Editar dados
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openChangePlan(r)}>
                              <RefreshCw className="h-4 w-4 mr-2" /> Alterar plano
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSuspendDialog(r)}>
                              {isSuspended ? <><CheckCircle className="h-4 w-4 mr-2 text-success" /> Reativar</> : <><Ban className="h-4 w-4 mr-2 text-warning" /> Suspender</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteRestaurant(r)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollReveal>
        )}
      </div>

      {/* ===== ADD RESTAURANT WIZARD ===== */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) setWizardStep(1); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Restaurante</DialogTitle>
            <DialogDescription>Etapa {wizardStep} de 4 — preencha os dados em sequência</DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-between mb-6 mt-2">
            {[
              { n: 1, label: 'Estabelecimento', icon: Store },
              { n: 2, label: 'Endereço', icon: MapPin },
              { n: 3, label: 'Plano', icon: CreditCard },
              { n: 4, label: 'Proprietário', icon: User },
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center flex-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  wizardStep > s.n ? 'bg-success text-success-foreground' :
                  wizardStep === s.n ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {wizardStep > s.n ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <div className="ml-2 hidden sm:block">
                  <p className={`text-xs font-medium ${wizardStep >= s.n ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</p>
                </div>
                {i < arr.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${wizardStep > s.n ? 'bg-success' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          <div className="space-y-4 min-h-[260px]">
            {/* STEP 1: Estabelecimento */}
            {wizardStep === 1 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Dados do Estabelecimento</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Nome *</label>
                    <input type="text" placeholder="Ex: Boteco do Zé" value={form.name} onChange={e => updateField('name', e.target.value)} className={inputClass} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Slug (URL) *</label>
                    <input type="text" placeholder="boteco-do-ze" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} className={inputClass} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">CNPJ</label>
                    <input type="text" placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e => updateField('cnpj', e.target.value)} className={inputClass} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">E-mail</label>
                    <input type="email" placeholder="contato@restaurante.com" value={form.email} onChange={e => updateField('email', e.target.value)} className={inputClass} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Telefone</label>
                    <input type="text" placeholder="(31) 99999-1234" value={form.phone} onChange={e => updateField('phone', e.target.value)} className={inputClass} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
                    <input type="text" placeholder="5531999991234" value={form.whatsapp} onChange={e => updateField('whatsapp', e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            )}

            {/* STEP 2: Endereço */}
            {wizardStep === 2 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Endereço</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground">Endereço</label>
                    <input type="text" placeholder="Rua, número, bairro" value={form.address} onChange={e => updateField('address', e.target.value)} className={inputClass} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Cidade</label>
                    <input type="text" placeholder="São Paulo" value={form.city} onChange={e => updateField('city', e.target.value)} className={inputClass} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-muted-foreground">UF</label>
                      <input type="text" placeholder="SP" maxLength={2} value={form.state} onChange={e => updateField('state', e.target.value.toUpperCase())} className={inputClass} /></div>
                    <div><label className="text-xs font-medium text-muted-foreground">CEP</label>
                      <input type="text" placeholder="01000-000" value={form.zip_code} onChange={e => updateField('zip_code', e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Plano */}
            {wizardStep === 3 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Plano & Status Inicial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Plano</label>
                    <select value={form.plan_id} onChange={e => setForm(p => ({ ...p, plan_id: e.target.value }))} className={inputClass}>
                      <option value="">Selecione um plano</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}/mês</option>)}
                    </select></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Status inicial</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className={inputClass}>
                      <option value="trial">Trial (14 dias)</option>
                      <option value="active">Ativo</option>
                    </select></div>
                </div>
                {form.plan_id && (
                  <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    {(() => {
                      const p = plans.find(pl => pl.id === form.plan_id);
                      if (!p) return null;
                      return (
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">R$ {Number(p.price).toFixed(2)}/mês • até {p.max_users} usuários • até {p.max_coupons} cupons</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Proprietário + Confirmação */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Conta do Proprietário <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-muted-foreground">Nome</label>
                      <input type="text" placeholder="João da Silva" value={form.owner_name} onChange={e => updateField('owner_name', e.target.value)} className={inputClass} /></div>
                    <div><label className="text-xs font-medium text-muted-foreground">E-mail</label>
                      <input type="email" placeholder="joao@email.com" value={form.owner_email} onChange={e => updateField('owner_email', e.target.value)} className={inputClass} /></div>
                    <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground">Senha inicial</label>
                      <input type="password" placeholder="Mínimo 6 caracteres" value={form.owner_password} onChange={e => updateField('owner_password', e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <p className="font-semibold mb-2">Resumo</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <span className="text-foreground font-medium">{form.name || '—'}</span> ({form.slug || '—'})</li>
                    <li>• Cidade: {form.city || '—'} {form.state ? `/ ${form.state}` : ''}</li>
                    <li>• Plano: {plans.find(p => p.id === form.plan_id)?.name || '—'} • Status: {form.status === 'trial' ? 'Trial 14d' : 'Ativo'}</li>
                    <li>• Proprietário: {form.owner_email || 'sem owner (vincular depois)'}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-border mt-4">
            <button
              onClick={() => setWizardStep(s => Math.max(1, s - 1))}
              disabled={wizardStep === 1 || saving}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            {wizardStep < 4 ? (
              <button
                onClick={() => setWizardStep(s => Math.min(4, s + 1))}
                disabled={wizardStep === 1 && (!form.name || !form.slug)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={handleCreate} disabled={saving || !form.name || !form.slug}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : <><Check className="h-4 w-4" /> Criar Restaurante</>}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT RESTAURANT DIALOG ===== */}
      <Dialog open={!!editRestaurant} onOpenChange={() => setEditRestaurant(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar — {editRestaurant?.name}</DialogTitle>
            <DialogDescription>Atualize os dados do restaurante</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input type="text" value={editForm.name || ''} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Slug *</label>
                <input type="text" value={editForm.slug || ''} onChange={e => setEditForm((p: any) => ({ ...p, slug: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">CNPJ</label>
                <input type="text" value={editForm.cnpj || ''} onChange={e => setEditForm((p: any) => ({ ...p, cnpj: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <input type="email" value={editForm.email || ''} onChange={e => setEditForm((p: any) => ({ ...p, email: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <input type="text" value={editForm.phone || ''} onChange={e => setEditForm((p: any) => ({ ...p, phone: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
                <input type="text" value={editForm.whatsapp || ''} onChange={e => setEditForm((p: any) => ({ ...p, whatsapp: e.target.value }))} className={inputClass} /></div>
            </div>
            {/* Telegram Config */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">📱 Telegram (Alertas de Estoque)</h3>
              <div><label className="text-xs font-medium text-muted-foreground">Chat ID do Telegram</label>
                <input type="text" value={editForm.telegram_chat_id || ''} onChange={e => setEditForm((p: any) => ({ ...p, telegram_chat_id: e.target.value }))} placeholder="Ex: 8434843310" className={inputClass} />
                <p className="text-xs text-muted-foreground mt-1">Ou o cliente pode vincular sozinho enviando <code>/start {editForm.slug || 'slug'}</code> ao bot no Telegram.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground">Endereço</label>
                <input type="text" value={editForm.address || ''} onChange={e => setEditForm((p: any) => ({ ...p, address: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <input type="text" value={editForm.city || ''} onChange={e => setEditForm((p: any) => ({ ...p, city: e.target.value }))} className={inputClass} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">UF</label>
                  <input type="text" maxLength={2} value={editForm.state || ''} onChange={e => setEditForm((p: any) => ({ ...p, state: e.target.value.toUpperCase() }))} className={inputClass} /></div>
                <div><label className="text-xs font-medium text-muted-foreground">CEP</label>
                  <input type="text" value={editForm.zip_code || ''} onChange={e => setEditForm((p: any) => ({ ...p, zip_code: e.target.value }))} className={inputClass} /></div>
              </div>
            </div>
            <button onClick={handleEdit} disabled={editSaving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
              {editSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar Dados do Restaurante'}
            </button>

            {/* Owner Credentials Section */}
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                🔑 Credenciais do Proprietário
                {!editRestaurant?.owner_id && <span className="text-xs font-normal text-muted-foreground">(nenhum proprietário vinculado)</span>}
              </h3>
              {editRestaurant?.owner_id ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-input bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">E-mail atual</p>
                    <p className="text-sm font-mono font-medium">{ownerEmail}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-muted-foreground">Novo e-mail</label>
                      <input type="email" placeholder="Deixe vazio para manter" value={ownerNewEmail} onChange={e => setOwnerNewEmail(e.target.value)} className={inputClass} /></div>
                    <div><label className="text-xs font-medium text-muted-foreground">Nova senha</label>
                      <input type="password" placeholder="Deixe vazio para manter" value={ownerNewPassword} onChange={e => setOwnerNewPassword(e.target.value)} className={inputClass} /></div>
                  </div>
                  <button onClick={handleUpdateCredentials} disabled={credentialsSaving || (!ownerNewEmail && !ownerNewPassword)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary text-primary px-4 py-2.5 text-sm font-semibold hover:bg-primary/10 disabled:opacity-50 transition-all">
                    {credentialsSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Atualizando...</> : 'Atualizar Credenciais'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Este restaurante ainda não tem um proprietário vinculado. Crie a conta na seção de usuários ou recrie o restaurante com um proprietário.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== CHANGE PLAN DIALOG ===== */}
      <Dialog open={!!planRestaurant} onOpenChange={() => setPlanRestaurant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Plano — {planRestaurant?.name}</DialogTitle>
            <DialogDescription>Selecione o novo plano para este restaurante</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {plans.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${newPlanId === p.id ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/50'}`}>
                  <input type="radio" name="plan" checked={newPlanId === p.id} onChange={() => setNewPlanId(p.id)} className="accent-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">R$ {Number(p.price).toFixed(0)}</span>
                </label>
              ))}
            </div>
            <button onClick={handleChangePlan} disabled={planSaving || !newPlanId}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
              {planSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Alterando...</> : 'Confirmar Alteração'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRM DIALOG ===== */}
      <Dialog open={!!deleteRestaurant} onOpenChange={() => setDeleteRestaurant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Excluir Restaurante
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteRestaurant?.name}</strong>? Esta ação é irreversível e removerá todos os dados associados (pedidos, produtos, mesas, etc).
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteRestaurant(null)}
              className="flex-1 rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleteSaving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-all">
              {deleteSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Excluindo...</> : 'Sim, Excluir'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== CREDENTIALS DIALOG ===== */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" /> Restaurante Criado!
            </DialogTitle>
            <DialogDescription>
              Envie as credenciais abaixo para o proprietário de <strong>{createdCredentials?.name}</strong> acessar o painel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {[
              { label: 'Link de acesso', value: createdCredentials?.loginUrl, key: 'url' },
              { label: 'E-mail', value: createdCredentials?.email, key: 'email' },
              { label: 'Senha', value: createdCredentials?.password, key: 'password' },
            ].map(item => (
              <div key={item.key} className="flex items-center gap-2 rounded-lg border border-input bg-muted/50 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-mono font-medium truncate">{item.value}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(item.value || '');
                    setCopiedField(item.key);
                    setTimeout(() => setCopiedField(null), 2000);
                  }}
                  className="shrink-0 p-2 rounded-lg hover:bg-background transition-colors"
                  title="Copiar"
                >
                  {copiedField === item.key ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const text = `🍺 Bora Uai — Acesso ao Painel\n\nLink: ${createdCredentials?.loginUrl}\nE-mail: ${createdCredentials?.email}\nSenha: ${createdCredentials?.password}\n\nTroque sua senha no primeiro acesso!`;
                navigator.clipboard.writeText(text);
                setCopiedField('all');
                setTimeout(() => setCopiedField(null), 2000);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
            >
              {copiedField === 'all' ? <><Check className="h-4 w-4" /> Copiado!</> : <><Copy className="h-4 w-4" /> Copiar tudo para enviar</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== SUSPEND / REACTIVATE DIALOG ===== */}
      <SuspendRestaurantDialog
        restaurant={suspendTarget?.restaurant ?? null}
        mode={suspendTarget?.mode ?? 'suspend'}
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onDone={invalidate}
      />
    </MasterLayout>
  );
}
