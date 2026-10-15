/** Pure configuration helpers also exercised without credentials in unit tests. */
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;
export type PaymentEnvironment = "sandbox" | "live";
export type PaymentConfig = { environment: PaymentEnvironment; key: string; live: boolean };

export function paymentConfig(
  env: NodeJS.ProcessEnv = process.env,
  allowPaused = false,
): PaymentConfig | null {
  const environment = env.STRIPE_ENVIRONMENT;
  const key = env.STRIPE_RESTRICTED_KEY;
  if (!key || (environment !== "sandbox" && environment !== "live")) return null;
  // Both the key and deployment mode must agree. No implicit fallback to live.
  if (!key.startsWith(environment === "live" ? "rk_live_" : "rk_test_")) return null;
  if (!allowPaused && environment === "live" && env.STRIPE_LIVE_PAYMENTS_ENABLED !== "true")
    return null;
  return { environment, key, live: environment === "live" };
}

export type HostPaymentAccess = { config: PaymentConfig; canOnboard: boolean };

/** Payout onboarding is independent of guest checkout. The sandbox authorizer
 * must read the current server-side admin role, never form data or user metadata. */
export async function hostPaymentAccess(
  env: NodeJS.ProcessEnv = process.env,
  verifySandboxAdmin?: () => Promise<boolean>,
): Promise<HostPaymentAccess | null> {
  const config = paymentConfig(env, true);
  if (!config) return null;
  if (config.environment === "sandbox") {
    try {
      if ((await verifySandboxAdmin?.()) !== true) return null;
    } catch {
      return null;
    }
    return { config, canOnboard: true };
  }
  return { config, canOnboard: env.STRIPE_LIVE_ONBOARDING_ENABLED === "true" };
}

export function assertMode(livemode: boolean, expected: PaymentEnvironment) {
  if (livemode !== (expected === "live")) throw new Error("Stripe environment mismatch.");
}

export function stripeRedirectUrl(value: string, kind: "checkout" | "connect"): string {
  const url = new URL(value);
  const allowed = kind === "checkout" ? ["checkout.stripe.com"] : ["connect.stripe.com"];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowed.includes(url.hostname)
  ) {
    throw new Error("Unexpected payment destination.");
  }
  return url.href;
}

/** Never reuse a creation operation after Stripe's idempotency retention window. */
export function assertCreationRetryWindow(createdAt: string, now = Date.now()) {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created) || now - created > 23 * 60 * 60 * 1000 || created > now + 60000) {
    throw new Error("This payment operation needs reconciliation before it can be retried.");
  }
}

export function checkoutExpiry(deadline: string, now = Date.now()): number {
  const seconds = Math.floor(Date.parse(deadline) / 1000);
  const current = Math.floor(now / 1000);
  // Leave a small network margin above Stripe's minimum 30-minute expiration.
  if (!Number.isFinite(seconds) || seconds < current + 31 * 60) {
    throw new Error("The payment window is too short to open checkout. Contact Qualia.");
  }
  return Math.min(seconds, current + 23 * 60 * 60);
}
