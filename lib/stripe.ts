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
 * Safely validates whether a given origin or hostname is trusted.
 * Only allows:
 * 1. localhost or 127.0.0.1 (local development)
 * 2. Official Vercel deployment domains (*.vercel.app)
 * 3. Configured production domains (matching NEXT_PUBLIC_APP_URL or VERCEL_PROJECT_PRODUCTION_URL)
 */
export function isTrustedOrigin(originOrHost: string | null | undefined): boolean {
  if (!originOrHost || !originOrHost.trim()) return false;
  try {
    const parsed = originOrHost.includes("://")
      ? new URL(originOrHost)
      : new URL(`https://${originOrHost}`);
    const hostname = parsed.hostname.toLowerCase();

    // 1. Localhost in development
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    // 2. Project-specific Vercel production and preview deployment domains
    // Positively restricts to this project's canonical and preview namespaces; rejects arbitrary *.vercel.app hosts
    if (
      hostname.endsWith(".vercel.app") &&
      (hostname === "danyelacierda-quinn-luxurious.vercel.app" ||
        hostname.startsWith("danyelacierda-quinn-luxur") ||
        hostname.startsWith("quinn-luxurious"))
    ) {
      return true;
    }

    // 3. Vercel deployment-specific URL match (automatically injected by Vercel for the current deployment)
    if (process.env.VERCEL_URL && process.env.VERCEL_URL !== "undefined") {
      const deployHost = process.env.VERCEL_URL
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "")
        .toLowerCase();
      if (deployHost && deployHost !== "undefined" && hostname === deployHost) {
        return true;
      }
    }

    // 3. Configured canonical production URL match
    if (process.env.NEXT_PUBLIC_APP_URL) {
      try {
        const canonical = new URL(process.env.NEXT_PUBLIC_APP_URL);
        if (hostname === canonical.hostname.toLowerCase()) {
          return true;
        }
      } catch {}
    }

    // 4. Vercel platform configured production domain match
    if (
      process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      process.env.VERCEL_PROJECT_PRODUCTION_URL !== "undefined"
    ) {
      const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "")
        .toLowerCase();
      if (prodHost && prodHost !== "undefined" && hostname === prodHost) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Returns the trusted public application base URL for Stripe redirect callbacks.
 * Enforces strict host validation to prevent host-header injection and open redirects.
 */
export function getAppBaseUrl(requestOrigin?: string | null): string {
  // 1. Pinned canonical production URL takes top priority in production environments
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    process.env.NEXT_PUBLIC_APP_URL.trim() &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
  ) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  // 2. If request origin is provided (from headers), strictly validate against trusted whitelist
  if (requestOrigin && isTrustedOrigin(requestOrigin)) {
    return requestOrigin.replace(/\/+$/, "");
  }

  // 3. Fallback to Vercel platform-injected production URL
  if (
    process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL.trim() &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL !== "undefined"
  ) {
    const cleanHost = process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (cleanHost && cleanHost !== "undefined") {
      return `https://${cleanHost}`;
    }
  }

  // 4. Fallback to Vercel deployment URL
  if (
    process.env.VERCEL_URL &&
    process.env.VERCEL_URL.trim() &&
    process.env.VERCEL_URL !== "undefined"
  ) {
    const cleanHost = process.env.VERCEL_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (cleanHost && cleanHost !== "undefined") {
      return `https://${cleanHost}`;
    }
  }

  // 5. Fallback to configured NEXT_PUBLIC_APP_URL (e.g. localhost:3000)
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  // 6. Safe development default
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
