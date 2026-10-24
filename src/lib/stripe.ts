import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith('pk_test_')) return 'sandbox';
  if (clientToken?.startsWith('pk_live_')) return 'live';
  return 'live';
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(keyOverride?: string): Promise<Stripe | null> {
  const token = keyOverride || clientToken;
  if (!token) {
    return Promise.resolve(null);
  }
  if (!stripePromise || keyOverride) {
    stripePromise = loadStripe(token);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}
