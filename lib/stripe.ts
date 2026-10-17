import Stripe from "stripe";

/**
 * Stripe Test-Mode Integration Client.
 * Strict Safeguard: Only test-mode credentials (sk_test_...) are permitted.
 * Live credentials and live events are categorically rejected.
 */
let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeInstance) return stripeInstance;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is missing. Please set your Stripe test-mode secret key (sk_test_...) in your environment."
    );
  }

  // Strict safety check: Positively require test-mode secret key prefix
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "SAFETY ENFORCEMENT: Invalid Stripe secret key. Only Stripe test-mode keys (sk_test_...) are permitted in this environment."
    );
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    appInfo: {
      name: "Quinn Luxurious Salon",
      version: "0.1.0",
    },
  });

  return stripeInstance;
}

/**
 * Returns the public application base URL for Stripe redirect callbacks.
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL && process.env.VERCEL_URL.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

/**
 * Verifies a Stripe webhook payload against the webhook signing secret.
 * Enforces signature validity and verifies that the event is test-mode (livemode === false).
 */
export function constructWebhookEvent(
  payload: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing.");
  }
  if (!signature) {
    throw new Error("Missing stripe-signature header.");
  }

  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  // Strict safety check: Validate that event is explicitly test-mode (not live)
  if (event.livemode === true) {
    throw new Error(
      "SAFETY ENFORCEMENT: Live-mode Stripe event rejected. Only test-mode events (livemode: false) are permitted."
    );
  }

  return event;
}
