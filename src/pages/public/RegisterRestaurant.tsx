import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { SEO } from '@/components/seo/SEO';

export default function RegisterRestaurant() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    restaurantName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    planId: '',
  });

  // Fallback estático: garante que a tela nunca trava se o banco estiver lento.
  const FALLBACK_PLANS = [
    { id: 'fallback-basic', name: 'Básico', tier: 'basic', price: 69.99, description: 'Ideal para começar: cardápio digital, pedidos e mesas.', features: ['Cardápio digital', 'QR Code mesas', 'Pedidos online', 'Suporte por e-mail'] },
    { id: 'fallback-pro', name: 'Pro', tier: 'pro', price: 119.99, description: 'Para quem quer crescer: KDS, delivery, CRM e relatórios.', features: ['Tudo do Básico', 'KDS / Cozinha', 'Delivery + entregadores', 'CRM de clientes', 'Relatórios completos'] },
    { id: 'fallback-premium', name: 'Premium', tier: 'premium', price: 199.99, description: 'Operação completa: balada, DJ, estoque, IA e multi-usuário.', features: ['Tudo do Pro', 'Modo Balada + DJ', 'Estoque + fichas', 'IA insights', 'Usuários ilimitados'] },
  ];

  const { data: plansRaw, isLoading: plansLoading, isError: plansError, refetch: refetchPlans, isFetching: plansFetching } = useQuery({
    queryKey: ['register-plans-v2'],
    queryFn: async () => {
      try { localStorage.removeItem('borauai_register_plans_cache_v1'); } catch {}
      const { data, error } = await (publicSupabase.from('subscription_plans' as any).select('*').eq('active', true).order('price') as any);
      if (error) throw error;
      const filtered = ((data as any[]) || []).filter(
        (p: any) => !p.name?.toLowerCase().includes('teste') && p.tier !== 'basic_test' && Number(p.price) >= 30
      );
      return filtered;
    },
    retry: 1,
    refetchOnMount: 'always',
    staleTime: 30_000,
  });

  // Sempre temos planos para mostrar: vivos > cache > fallback estático
  const plans = (plansRaw && plansRaw.length > 0) ? plansRaw : FALLBACK_PLANS;
  const usingFallback = !plansRaw || plansRaw.length === 0;

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

  const handleRegister = async () => {
    if (!form.restaurantName || !form.email || !form.password || !form.planId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setLoading(true);
    try {
      // 1. Create auth user or identify existing user (with fallback to admin API if rate limited)
      let userId: string | undefined;
      const cleanEmail = form.email.trim().toLowerCase();

      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: form.password,
          options: {
            data: { full_name: form.ownerName },
            emailRedirectTo: `${window.location.origin}/restaurant/login`,
          },
        });

        if (!authErr && authData?.user) {
          userId = authData.user.id;
        } else if (authErr) {
          const isRateLimit = authErr.message?.toLowerCase().includes('rate limit') || (authErr as any)?.code === 'over_email_send_rate_limit';
          const isExisting = authErr.message?.toLowerCase().includes('already registered') || (authErr as any)?.code === 'user_already_exists';
          
          if (isExisting) {
            const { data: signInData } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: form.password,
            });
            if (signInData?.user) {
              userId = signInData.user.id;
            }
          } else if (isRateLimit) {
            console.warn('[RegisterRestaurant] Email rate limit hit on client signUp. Will auto-create/confirm via admin service role without sending email.');
          } else {
            console.warn('[RegisterRestaurant] Client signUp warning, continuing to admin provisioning:', authErr.message);
          }
        }
      } catch (clientAuthErr: any) {
        console.warn('[RegisterRestaurant] Auth step exception (delegating to backend):', clientAuthErr?.message);
      }

      // 2. Provision restaurant via service-role backend API
      const planTier = form.planId.startsWith('fallback-')
        ? form.planId.replace('fallback-', '')
        : plans.find((p: any) => p.id === form.planId)?.tier;

      const payload = {
        email: cleanEmail,
        password: form.password,
        restaurantName: form.restaurantName,
        ownerName: form.ownerName,
        phone: form.phone,
        planId: form.planId.startsWith('fallback-') ? undefined : form.planId,
        planTier,
        userId,
      };

      let provisioned = false;
      let provErrorMsg = '';

      // Primary: call serverless /api/provision-restaurant
      try {
        const resp = await fetch('/api/provision-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const respData = await resp.json();
        if (resp.ok && respData?.ok) {
          provisioned = true;
        } else {
          provErrorMsg = respData?.error || 'Erro ao provisionar restaurante';
        }
      } catch (e: any) {
        provErrorMsg = e.message;
      }

      // Secondary fallback: call Supabase Edge Function
      if (!provisioned) {
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('provision-restaurant', {
            body: payload,
          });
          if (!fnErr && fnData?.ok) {
            provisioned = true;
          } else if (fnErr) {
            provErrorMsg = fnErr.message || provErrorMsg;
          }
        } catch (e: any) {
          console.warn('[RegisterRestaurant] Edge function fallback error:', e);
        }
      }

      if (!provisioned && provErrorMsg) {
        throw new Error(provErrorMsg);
      }

      // 3. Try to sign in automatically to give immediate access
      try {
        const { data: loginData } = await supabase.auth.signInWithPassword({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (loginData?.session) {
          toast.success('Restaurante cadastrado com sucesso! Bem-vindo ao Bora Uai.');
          navigate('/restaurant');
          setLoading(false);
          return;
        }
      } catch {}

      toast.success('Restaurante criado com sucesso! Faça login para começar.');
      navigate('/restaurant/login');
    } catch (err: any) {
      console.error('[RegisterRestaurant] Registration error:', err);
      toast.error(err.message || 'Erro ao cadastrar restaurante');
    }
    setLoading(false);
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center p-4 font-public">
      <SEO
        title="Cadastre seu Restaurante — Bora Uai | 14 dias grátis"
        description="Crie sua conta no Bora Uai em 2 minutos. 14 dias grátis do plano Profissional, sem cartão de crédito. Cardápio QR, KDS, delivery e comanda."
        path="/cadastro"
      />
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="card-elevated p-8">
          <h1 className="font-heading text-2xl font-bold mb-1">Cadastre seu restaurante</h1>
          <p className="text-sm text-muted-foreground mb-6">14 dias grátis · Sem cartão de crédito</p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step > s ? 'bg-success text-white' : step === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && <div className={`h-0.5 w-8 ${step > s ? 'bg-success' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-heading font-semibold">Dados do restaurante</h2>
              <div>
                <label className="text-sm font-medium">Nome do restaurante *</label>
                <input type="text" value={form.restaurantName} onChange={e => setForm({ ...form, restaurantName: e.target.value })}
                  placeholder="Ex: Boteco do Zé" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone / WhatsApp</label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="(31) 99999-9999" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <button onClick={() => form.restaurantName ? setStep(2) : toast.error('Informe o nome')}
                className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                Continuar
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-heading font-semibold">Sua conta</h2>
              <div>
                <label className="text-sm font-medium">Seu nome *</label>
                <input type="text" value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  autoComplete="email" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Senha *</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-border py-3 text-sm font-medium hover:bg-muted transition-colors">Voltar</button>
                <button onClick={() => form.email && form.password ? setStep(3) : toast.error('Preencha e-mail e senha')}
                  className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-heading font-semibold">Escolha seu plano</h2>
              <p className="text-xs text-muted-foreground">Todos começam com 14 dias grátis</p>
              {usingFallback && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex items-start gap-2">
                  {plansFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 mt-0.5" /> : <span className="text-amber-600">⚠</span>}
                  <div className="flex-1">
                    <p className="font-medium text-amber-700 dark:text-amber-400">Mostrando planos padrão</p>
                    <p className="text-muted-foreground mt-0.5">Nosso servidor está um pouco lento. Você pode escolher e continuar — confirmaremos o plano ao criar a conta.</p>
                    <button onClick={() => refetchPlans()} disabled={plansFetching} className="mt-1.5 underline text-primary disabled:opacity-50">
                      Tentar carregar ao vivo
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-3">

                {plans.map(plan => {
                  const features: string[] = Array.isArray(plan.features) ? (plan.features as string[]) : [];
                  return (
                    <button key={plan.id} onClick={() => setForm({ ...form, planId: plan.id })}
                      className={`w-full text-left rounded-xl p-4 border-2 transition-all ${
                        form.planId === plan.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-heading font-bold">{plan.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{plan.tier}</span>
                        </div>
                        <span className="font-heading font-bold text-lg">{fmt(plan.price)}<span className="text-xs text-muted-foreground">/mês</span></span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                      {features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {features.slice(0, 4).map((f, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Check className="h-3 w-3 text-primary" />{String(f)}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-border py-3 text-sm font-medium hover:bg-muted transition-colors">Voltar</button>
                <button onClick={handleRegister} disabled={loading || !form.planId}
                  className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : 'Criar restaurante'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
