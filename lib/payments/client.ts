import "server-only";
import Stripe from "stripe";
import { paymentConfig, STRIPE_API_VERSION } from "./config";

export function paymentRuntime(allowPaused = false) {
  const config = paymentConfig(process.env, allowPaused);
  if (!config) throw new Error("Payments are not available yet. Please contact Qualia.");
  return {
    config,
    stripe: new Stripe(config.key, {
      apiVersion: STRIPE_API_VERSION,
      maxNetworkRetries: 2,
      timeout: 15000,
      appInfo: { name: "Qualia", version: "0.1.0" },
    }),
  };
}
