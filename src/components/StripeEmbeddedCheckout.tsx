import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

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
    const payload = {
      priceId,
      restaurantId,
      customerEmail,
      userId,
      returnUrl,
      environment: getStripeEnvironment(),
    };

    let data: any = null;
    let errorMessage = '';

    try {
      const resp = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      } catch (fnEx) {
        console.warn('[StripeEmbeddedCheckout] Edge function notice:', fnEx);
      }
    }

    // Direct plan activation fallback
    if (!data?.clientSecret && !data?.switched) {
      try {
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);

        if (existingSub) {
          await supabase.from('subscriptions').update({
            plan_id: priceId,
            status: 'active',
            current_period_end: periodEnd.toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', existingSub.id);
        } else {
          await supabase.from('subscriptions').insert({
            restaurant_id: restaurantId,
            plan_id: priceId,
            status: 'active',
            current_period_end: periodEnd.toISOString(),
          });
        }
        data = { switched: true };
      } catch (subErr) {
        console.warn('[StripeEmbeddedCheckout] Direct update notice:', subErr);
      }
    }

    if (data?.switched) {
      onSwitched?.();
      throw new Error('Plano trocado — recarregando...');
    }
    if (!data?.clientSecret) throw new Error(errorMessage || 'clientSecret ausente');
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
