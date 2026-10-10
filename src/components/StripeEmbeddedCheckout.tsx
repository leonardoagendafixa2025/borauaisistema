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
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId, restaurantId, customerEmail, userId, returnUrl, environment: getStripeEnvironment() },
    });
    if (error) throw new Error(error.message || "Falha ao iniciar checkout");
    if (data?.switched) {
      onSwitched?.();
      throw new Error("Plano trocado — recarregando...");
    }
    if (!data?.clientSecret) throw new Error("clientSecret ausente");
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
