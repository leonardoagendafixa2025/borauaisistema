import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getStripeEnvironment } from '@/lib/stripe';
import { CreditCard, Check, AlertTriangle, Loader2, ArrowLeft, Calendar, Receipt, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';

export default function BillingPage() {
  const { restaurantId, user } = useAuth();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get('checkout') === 'success') {
      toast.success('Pagamento processado! A ativação pode levar alguns segundos.');
    }
  }, [params]);

  const env = (() => {
    try { return getStripeEnvironment(); } catch { return 'sandbox' as const; }
  })();

  const { data: sub, isLoading } = useQuery({
    queryKey: ['my-subscription', restaurantId, env],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(name, tier, price, description, features, stripe_lookup_key)')
        .eq('restaurant_id', restaurantId)
        .eq('environment', env)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!restaurantId,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['available-plans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('active', true)
        .order('price', { ascending: true });
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['my-payments', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Realtime sync
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`sub-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `restaurant_id=eq.${restaurantId}` },
        () => qc.invalidateQueries({ queryKey: ['my-subscription', restaurantId, env] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, env, qc]);

  const fmt = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  const status = (sub?.status as string | undefined) ?? '';
  const isActive = status === 'active' || status === 'trialing';
  const isPastDue = status === 'past_due';
  const isCanceled = status === 'canceled' || status === 'cancelled';
  const isTrialActive = status === 'trial' && sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date();
  const trialDaysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;
  const cancelScheduled = sub?.cancel_at_period_end;

  const handlePortal = async () => {
    setBusy('portal');
    try {
      let data: any = null;
      let errorMsg = '';
      try {
        const res = await fetch('/api/create-portal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId, environment: env, returnUrl: window.location.href }),
        });
        data = await res.json();
        if (!res.ok) errorMsg = data?.error;
      } catch (e: any) {
        errorMsg = e.message;
      }

      if (!data?.url) {
        try {
          const fnRes = await supabase.functions.invoke('create-portal-session', {
            body: { restaurantId, environment: env, returnUrl: window.location.href },
          });
          if (!fnRes.error && fnRes.data?.url) {
            data = fnRes.data;
          }
        } catch (fnEx) {
          console.warn('[BillingPage] Portal edge function notice:', fnEx);
        }
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        toast.info('Portal de gerenciamento Stripe disponível assim que a primeira assinatura for concluída.');
      }
    } catch (err: any) {
      const friendly = err.message?.includes('Edge Function') || err.message?.includes('FunctionsFetchError')
        ? 'Portal indisponível no momento'
        : (err.message || 'Erro ao abrir portal de gerenciamento');
      toast.error(friendly);
    } finally {
      setBusy(null);
    }
  };

  const handleSelectPlan = (lookupKey?: string, planId?: string) => {
    const key = lookupKey || planId;
    if (!key) {
      toast.error('Identificador do plano ausente');
      return;
    }
    setCheckoutPriceId(key);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (checkoutPriceId && restaurantId) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            <button onClick={() => setCheckoutPriceId(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="card-elevated p-2 md:p-4">
              <StripeEmbeddedCheckout
                priceId={checkoutPriceId}
                restaurantId={restaurantId}
                customerEmail={user?.email ?? undefined}
                userId={user?.id}
                returnUrl={`${window.location.origin}/restaurant/billing/sucesso?session_id={CHECKOUT_SESSION_ID}`}
                onSwitched={() => {
                  toast.success('Plano atualizado com proração!');
                  setCheckoutPriceId(null);
                  qc.invalidateQueries({ queryKey: ['my-subscription', restaurantId, env] });
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Link to="/restaurant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar ao painel
          </Link>

          <div className="card-elevated p-6 md:p-8 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <h1 className="font-heading text-2xl font-bold">Assinatura & Cobrança</h1>
                <p className="text-sm text-muted-foreground">Gerencie sua assinatura via Stripe</p>
              </div>
              {sub && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  isActive ? 'bg-success/10 text-success' :
                  status === 'trial' ? 'bg-primary/10 text-primary' :
                  isPastDue ? 'bg-warning/10 text-warning' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {isActive && <Check className="h-3 w-3" />}
                  {status === 'trial' && <Calendar className="h-3 w-3" />}
                  {(isPastDue || isCanceled) && <AlertTriangle className="h-3 w-3" />}
                  {isActive ? 'Ativa' :
                   status === 'trial' ? `Trial - ${trialDaysLeft}d` :
                   isPastDue ? 'Pagamento pendente' :
                   isCanceled ? 'Cancelada' : status}
                </span>
              )}
            </div>

            {sub?.subscription_plans && (
              <div className="rounded-xl border border-border p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-heading font-bold text-lg">{(sub.subscription_plans as any).name}</span>
                  <span className="font-heading font-bold text-xl">
                    {fmt((sub.subscription_plans as any).price)}<span className="text-xs text-muted-foreground font-normal">/mês</span>
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{(sub.subscription_plans as any).description}</p>
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Período atual:</span>
                    <p className="font-medium">{fmtDate(sub.current_period_start)} → {fmtDate(sub.current_period_end)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Último pagamento:</span>
                    <p className="font-medium">{fmtDate(sub.last_payment_at)}</p>
                  </div>
                </div>
              </div>
            )}

            {isPastDue && (
              <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Pagamento pendente</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Seu acesso continua liberado enquanto o Stripe tenta novamente. Atualize seu cartão pelo portal para evitar bloqueio.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {cancelScheduled && !isCanceled && (
              <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 mb-6">
                <p className="text-sm">
                  Assinatura cancelada — você mantém acesso até <strong>{fmtDate(sub?.current_period_end)}</strong>.
                </p>
              </div>
            )}

            {isCanceled && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 mb-6">
                <p className="text-sm text-destructive font-bold">Assinatura encerrada. Escolha um plano abaixo para reativar.</p>
              </div>
            )}

            {isTrialActive && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-6">
                <p className="text-sm">
                  <strong>{trialDaysLeft} dias restantes</strong> no seu trial. Assine agora para garantir continuidade.
                </p>
              </div>
            )}

            {/* Ações para assinatura ativa */}
            {(isActive || isPastDue) && sub?.stripe_customer_id && (
              <button
                onClick={handlePortal}
                disabled={busy === 'portal'}
                className="w-full rounded-lg border border-border py-3 text-sm font-bold hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Gerenciar pagamento, faturas e cancelamento
              </button>
            )}
          </div>

          {/* Plan picker */}
          <div className="card-elevated p-6 mb-6">
            <h2 className="font-heading font-bold text-lg mb-4">
              {isActive || isPastDue ? 'Trocar de plano' : 'Escolher plano'}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {isActive ? 'A diferença é cobrada/creditada imediatamente (proração).' : 'Cobrança recorrente mensal pelo Stripe. Cancele a qualquer momento.'}
            </p>
            <div className="space-y-2">
              {plans.map((p: any) => {
                const isCurrent = sub?.plan_id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPlan(p.stripe_lookup_key, p.id)}
                    disabled={isCurrent}
                    className="w-full text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{p.name} {isCurrent && <span className="text-xs text-primary ml-2">• plano atual</span>}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                      <span className="font-heading font-bold">{fmt(p.price)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {payments.length > 0 && (
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-heading font-bold">Histórico de pagamentos</h2>
              </div>
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium">{fmt(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.paid_at || p.created_at)} · {p.payment_method || '—'}</p>
                    </div>
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                      p.status === 'approved' ? 'bg-success/10 text-success' :
                      p.status === 'pending' ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {p.status === 'approved' ? 'Aprovado' : p.status === 'pending' ? 'Pendente' : 'Recusado'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
