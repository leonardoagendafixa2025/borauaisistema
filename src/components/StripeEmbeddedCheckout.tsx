import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { getApiUrl } from "@/lib/api";
import { Loader2, AlertTriangle, RefreshCw, MessageCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  priceId: string;
  restaurantId: string;
  customerEmail?: string;
  userId?: string;
  returnUrl: string;
  onSwitched?: () => void;
  onCancel?: () => void;
}

export function StripeEmbeddedCheckout({
  priceId,
  restaurantId,
  customerEmail,
  userId,
  returnUrl,
  onSwitched,
  onCancel,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [supportPhone, setSupportPhone] = useState('31975385879');

  useEffect(() => {
    supabase
      .from('platform_settings' as any)
      .select('value')
      .eq('key', 'support_whatsapp')
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.value) setSupportPhone(String(data.value).replace(/\D/g, ''));
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function initCheckout() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const payload = {
          priceId,
          restaurantId,
          customerEmail: customerEmail || session?.user?.email,
          userId: userId || session?.user?.id,
          returnUrl,
          environment: getStripeEnvironment(),
        };

        let resultData: any = null;
        let errorMessage = '';

        try {
          const resp = await fetch(getApiUrl('/api/create-checkout'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
          resultData = await resp.json();
          if (!resp.ok) {
            errorMessage = resultData?.error || 'Falha ao iniciar checkout no servidor';
          }
        } catch (e: any) {
          errorMessage = e.message || 'Erro de conexão com o servidor de pagamentos';
        }

        // Tenta fallback edge function apenas se não houver resposta
        if (!resultData?.clientSecret && !resultData?.switched && !errorMessage) {
          try {
            const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-checkout', {
              body: payload,
            });
            if (!fnErr && fnData) resultData = fnData;
            else if (fnErr) errorMessage = fnErr.message;
          } catch (fnEx: any) {
            console.warn('[StripeEmbeddedCheckout] Edge function notice:', fnEx);
          }
        }

        if (!isMounted) return;

        if (resultData?.switched) {
          onSwitched?.();
          return;
        }

        if (resultData?.clientSecret) {
          setClientSecret(resultData.clientSecret);
          setLoading(false);
          return;
        }

        // Se chegou aqui, houve falha
        setError({
          message: errorMessage || resultData?.error || 'Não foi possível carregar o formulário de pagamento.',
          code: resultData?.code,
        });
        setLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        setError({
          message: err.message || 'Erro inesperado ao inicializar pagamento.',
        });
        setLoading(false);
      }
    }

    initCheckout();

    return () => {
      isMounted = false;
    };
  }, [priceId, restaurantId, retryKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[380px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h3 className="text-base font-semibold">Conectando ao gateway de pagamento seguro...</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Estamos preparando a sessão criptografada do Stripe para você concluir sua assinatura com total segurança.
        </p>
      </div>
    );
  }

  if (error) {
    const isConfigError = error.code === 'STRIPE_NOT_CONFIGURED' || error.message.toLowerCase().includes('stripe_secret_key');
    const waText = encodeURIComponent(
      `Olá! Tentei assinar o plano Bora Uai no sistema e gostaria de pagar via PIX ou concluir a ativação.\nRestaurante ID: ${restaurantId}`
    );
    const waLink = `https://wa.me/55${supportPhone}?text=${waText}`;

    return (
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/30 p-4">
          <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-base text-destructive">
              Não foi possível carregar o formulário de pagamento
            </h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>

        {isConfigError && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-600 dark:text-amber-400 space-y-1">
            <p className="font-bold">Aviso para o Administrador da Plataforma:</p>
            <p>
              A chave secreta do Stripe (<code>sk_live_...</code>) ainda não foi preenchida. Configure-a em{' '}
              <strong>Master &gt; Integrações &gt; Stripe</strong> ou nas variáveis de ambiente da Vercel (<code>STRIPE_SECRET_KEY</code>) para habilitar o pagamento automático no cartão.
            </p>
          </div>
        )}

        <div className="rounded-xl bg-muted/40 border border-border p-5 space-y-4">
          <div>
            <h4 className="font-semibold text-sm">Precisa ativar agora ou prefere pagar via PIX?</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fale direto com nosso suporte pelo WhatsApp para receber a chave PIX e liberar seu acesso imediatamente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Pagar via PIX / Falar no WhatsApp
            </a>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRetryKey(k => k + 1)}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>

            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Voltar aos planos
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!clientSecret) return null;

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
