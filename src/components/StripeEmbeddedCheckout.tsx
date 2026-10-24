import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { getApiUrl } from "@/lib/api";

interface Props {
  priceId: string;
  restaurantId: string;
  customerEmail?: string;
  userId?: string;
  returnUrl: string;
  onSwitched?: () => void;
}

export function StripeEmbeddedCheckout({ priceId, restaurantId, customerEmail, userId, returnUrl, onSwitched }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
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

    let data: any = null;
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
      data = await resp.json();
      if (!resp.ok) {
        errorMessage = data?.error || 'Falha ao iniciar checkout';
      }
    } catch (e: any) {
      errorMessage = e.message;
    }

    if (!data?.clientSecret && !data?.switched) {
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-checkout', {
          body: payload,
        });
        if (!fnErr && fnData) data = fnData;
        else if (fnErr) errorMessage = fnErr.message;
      } catch (fnEx) {
        console.warn('[StripeEmbeddedCheckout] Edge function notice:', fnEx);
      }
    }

    if (data?.switched) {
      onSwitched?.();
      throw new Error('Plano alterado com sucesso! Recarregando...');
    }
    if (!data?.clientSecret) throw new Error(errorMessage || 'Não foi possível carregar o formulário de pagamento.');
    return data.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
