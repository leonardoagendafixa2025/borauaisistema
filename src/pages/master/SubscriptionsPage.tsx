import { TrendingUp, Users, AlertTriangle, CheckCircle2, Edit, X, Plus, Ban, RefreshCw } from 'lucide-react';
import MasterLayout from '@/components/layout/MasterLayout';
import MetricCard from '@/components/MetricCard';
import ScrollReveal from '@/components/ScrollReveal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type SubscriptionStatus = Database['public']['Enums']['subscription_status'];

const statusMap: Record<string, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-success/10 text-success' },
  trial: { label: 'Trial', cls: 'bg-primary/10 text-primary' },
  overdue: { label: 'Inadimplente', cls: 'bg-destructive/10 text-destructive' },
  suspended: { label: 'Suspenso', cls: 'bg-warning/10 text-warning' },
  cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
};

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assignRestaurantId, setAssignRestaurantId] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');
  const [tab, setTab] = useState<'subscriptions' | 'plans'>('subscriptions');

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('subscription_plans').select('*').order('price');
      return data || [];
    },
  });

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['all-subscriptions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*, restaurants(name), subscription_plans(name, tier)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants-no-sub'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurants').select('id, name').order('name');
      return data || [];
    },
  });

  // Plan CRUD
  const updatePlanMutation = useMutation({
    mutationFn: async (plan: any) => {
      const { id, ...rest } = plan;
      const { error } = await supabase.from('subscription_plans').update({
        name: rest.name,
        price: rest.price,
        description: rest.description,
        max_users: rest.max_users,
        max_coupons: rest.max_coupons,
        advanced_reports: rest.advanced_reports,
        custom_domain: rest.custom_domain,
        visual_customization: rest.visual_customization,
        active: rest.active,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setEditingPlan(null);
      toast.success('Plano atualizado');
    },
    onError: () => toast.error('Erro ao atualizar plano'),
  });

  // Subscription mutations
  const updateSubStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SubscriptionStatus }) => {
      const { error } = await supabase.from('subscriptions').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const updateSubMutation = useMutation({
    mutationFn: async (sub: any) => {
      const { error } = await supabase.from('subscriptions').update({
        plan_id: sub.plan_id,
        monthly_price: sub.monthly_price,
        status: sub.status,
        platform_fee_percent: sub.platform_fee_percent,
      }).eq('id', sub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      setEditingSub(null);
      toast.success('Assinatura atualizada');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const assignSubMutation = useMutation({
    mutationFn: async () => {
      const plan = plans.find(p => p.id === assignPlanId);
      if (!plan) throw new Error('Plano não encontrado');
      const { error } = await supabase.from('subscriptions').insert({
        restaurant_id: assignRestaurantId,
        plan_id: assignPlanId,
        monthly_price: plan.price,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) {
        const resp = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: assignPlanId, restaurantId: assignRestaurantId }),
        });
        if (!resp.ok) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      setShowAssign(false);
      setAssignRestaurantId('');
      setAssignPlanId('');
      toast.success('Assinatura criada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar'),
  });

  const active = subscriptions.filter(s => s.status === 'active').length;
  const trial = subscriptions.filter(s => s.status === 'trial').length;
  const overdue = subscriptions.filter(s => s.status === 'overdue').length;
  const mrr = subscriptions.filter(s => ['active', 'trial'].includes(s.status)).reduce((s, sub) => s + Number(sub.monthly_price), 0);

  const tierColors: Record<string, string> = { basic: 'bg-muted', professional: 'bg-primary/10', premium: 'bg-accent/10' };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold">Assinaturas & Planos</h1>
              <p className="text-sm text-muted-foreground">Gestão completa de planos e assinaturas dos restaurantes</p>
            </div>
            <button onClick={() => setShowAssign(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Atribuir assinatura
            </button>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Assinaturas ativas', value: active + trial, icon: CheckCircle2, change: `${trial} em trial`, changeType: 'positive' as const },
            { label: 'MRR', value: fmt(mrr), icon: TrendingUp, change: `${active} pagantes`, changeType: 'positive' as const },
            { label: 'Em trial', value: trial, icon: Users, change: 'Aguardando conversão', changeType: 'neutral' as const },
            { label: 'Inadimplentes', value: overdue, icon: AlertTriangle, change: overdue > 0 ? 'Ação necessária' : 'Nenhum', changeType: overdue > 0 ? 'negative' as const : 'positive' as const },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 60}><MetricCard {...m} /></ScrollReveal>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button onClick={() => setTab('subscriptions')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'subscriptions' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Assinaturas</button>
          <button onClick={() => setTab('plans')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'plans' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Planos</button>
        </div>

        {/* Plans tab */}
        {tab === 'plans' && (
          <ScrollReveal>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {plans.map(p => {
                const count = subscriptions.filter(s => s.plan_id === p.id && ['active', 'trial'].includes(s.status)).length;
                return (
                  <div key={p.id} className={`card-elevated p-5 ${!p.active ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tierColors[p.tier] || 'bg-muted'}`}>{p.tier}</span>
                      <button onClick={() => setEditingPlan({ ...p })} className="p-1 rounded hover:bg-muted"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                    </div>
                    <h3 className="font-heading font-bold text-lg">{p.name}</h3>
                    <p className="text-2xl font-heading font-bold mt-1">{fmt(p.price)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                    <p className="text-xs text-muted-foreground mt-2">{p.description}</p>
                    <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Restaurantes ativos</span><span className="font-medium">{count}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Máx. usuários</span><span className="font-medium">{p.max_users}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Máx. cupons</span><span className="font-medium">{p.max_coupons}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Relatórios avançados</span><span className="font-medium">{p.advanced_reports ? '✓' : '✗'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Domínio personalizado</span><span className="font-medium">{p.custom_domain ? '✓' : '✗'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Personalização visual</span><span className="font-medium">{p.visual_customization ? '✓' : '✗'}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollReveal>
        )}

        {/* Subscriptions tab */}
        {tab === 'subscriptions' && (
          <ScrollReveal>
            <div className="card-elevated">
              <div className="p-5 pb-3">
                <h3 className="font-heading font-semibold text-base">Todas as assinaturas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 py-3">Restaurante</th>
                      <th className="text-left font-medium px-5 py-3">Plano</th>
                      <th className="text-left font-medium px-5 py-3">Status</th>
                      <th className="text-right font-medium px-5 py-3 hidden sm:table-cell">Valor</th>
                      <th className="text-right font-medium px-5 py-3 hidden md:table-cell">Taxa %</th>
                      <th className="text-right font-medium px-5 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
                    ) : subscriptions.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma assinatura</td></tr>
                    ) : subscriptions.map(s => {
                      const st = statusMap[s.status] || statusMap.active;
                      const restaurantName = (s as any).restaurants?.name || '—';
                      const planName = (s as any).subscription_plans?.name || '—';
                      return (
                        <tr key={s.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-medium">{restaurantName}</td>
                          <td className="px-5 py-3 text-muted-foreground">{planName}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums hidden sm:table-cell">{fmt(Number(s.monthly_price))}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground hidden md:table-cell">{s.platform_fee_percent || 0}%</td>
                          <td className="px-5 py-3 text-right">
                            <div className="inline-flex gap-1">
                              <button onClick={() => setEditingSub({ ...s })} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
                                <Edit className="h-4 w-4 text-muted-foreground" />
                              </button>
                              {s.status !== 'cancelled' ? (
                                <button
                                  onClick={() => { if (confirm('Cancelar esta assinatura?')) updateSubStatusMutation.mutate({ id: s.id, status: 'cancelled' }); }}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Cancelar"
                                >
                                  <Ban className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateSubStatusMutation.mutate({ id: s.id, status: 'active' })}
                                  className="p-1.5 rounded-lg hover:bg-success/10 transition-colors" title="Reativar"
                                >
                                  <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-success" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* Edit plan modal */}
        {editingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setEditingPlan(null)}>
            <div className="card-elevated w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-lg">Editar Plano</h3>
                <button onClick={() => setEditingPlan(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Nome</label>
                  <input type="text" value={editingPlan.name} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Preço (R$)</label>
                  <input type="number" value={editingPlan.price} onChange={e => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <textarea value={editingPlan.description || ''} onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Máx. usuários</label>
                    <input type="number" value={editingPlan.max_users} onChange={e => setEditingPlan({ ...editingPlan, max_users: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Máx. cupons</label>
                    <input type="number" value={editingPlan.max_coupons} onChange={e => setEditingPlan({ ...editingPlan, max_coupons: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'advanced_reports', label: 'Relatórios avançados' },
                    { key: 'custom_domain', label: 'Domínio personalizado' },
                    { key: 'visual_customization', label: 'Personalização visual' },
                    { key: 'active', label: 'Plano ativo' },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={editingPlan[f.key]} onChange={e => setEditingPlan({ ...editingPlan, [f.key]: e.target.checked })} className="rounded border-border" />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingPlan(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={() => updatePlanMutation.mutate(editingPlan)}
                  disabled={updatePlanMutation.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updatePlanMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit subscription modal */}
        {editingSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setEditingSub(null)}>
            <div className="card-elevated w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-lg">Editar Assinatura</h3>
                <button onClick={() => setEditingSub(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{(editingSub as any).restaurants?.name}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Plano</label>
                  <select value={editingSub.plan_id} onChange={e => {
                    const plan = plans.find(p => p.id === e.target.value);
                    setEditingSub({ ...editingSub, plan_id: e.target.value, monthly_price: plan?.price || editingSub.monthly_price });
                  }} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} - {fmt(p.price)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Valor mensal (R$)</label>
                  <input type="number" value={editingSub.monthly_price} onChange={e => setEditingSub({ ...editingSub, monthly_price: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select value={editingSub.status} onChange={e => setEditingSub({ ...editingSub, status: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Taxa plataforma (%)</label>
                  <input type="number" value={editingSub.platform_fee_percent || 0} onChange={e => setEditingSub({ ...editingSub, platform_fee_percent: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingSub(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={() => updateSubMutation.mutate(editingSub)}
                  disabled={updateSubMutation.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updateSubMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign subscription modal */}
        {showAssign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setShowAssign(false)}>
            <div className="card-elevated w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-lg">Atribuir Assinatura</h3>
                <button onClick={() => setShowAssign(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Restaurante</label>
                  <select value={assignRestaurantId} onChange={e => setAssignRestaurantId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Selecione...</option>
                    {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Plano</label>
                  <select value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Selecione...</option>
                    {plans.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} - {fmt(p.price)}/mês</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAssign(false)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={() => assignSubMutation.mutate()}
                  disabled={!assignRestaurantId || !assignPlanId || assignSubMutation.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {assignSubMutation.isPending ? 'Criando...' : 'Atribuir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MasterLayout>
  );
}
