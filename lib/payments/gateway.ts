import "server-only";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { assertMode, checkoutExpiry, stripeRedirectUrl, type PaymentEnvironment } from "./config";
import { canonicalPayment } from "./canonical";

export type CheckoutQuote = {
  attempt_id: string;
  booking_id: string;
  host_id: string;
  guest_id: string;
  amount_cents: number;
  currency: "usd";
  expires_at: string;
  created_at: string;
  stripe_account_id: string;
  title: string;
};

export async function retrievePayment(
  stripe: Stripe,
  sessionId: string,
  environment: PaymentEnvironment,
) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge.balance_transaction"],
  });
  assertMode(session.livemode, environment);
  return canonicalPayment(session);
}

export async function createCheckoutSession(stripe: Stripe, quote: CheckoutQuote, siteUrl: string) {
  const metadata = { qualia_attempt_id: quote.attempt_id, qualia_booking_id: quote.booking_id };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: quote.booking_id,
      metadata,
      payment_intent_data: { metadata, transfer_group: `qualia_booking_${quote.booking_id}` },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: quote.currency,
            unit_amount: quote.amount_cents,
            // Keep the payload stable across rolling deploys and retries. Party
            // details appear on the booking page; this is the frozen total once.
            product_data: { name: quote.title },
          },
        },
      ],
      expires_at: checkoutExpiry(quote.expires_at),
      success_url: `${siteUrl}/bookings/${quote.booking_id}`,
      cancel_url: `${siteUrl}/bookings/${quote.booking_id}`,
      integration_identifier: "qualia_hosted_checkout_qaliexpa",
      // Payment methods are configured in Stripe; never hardcode a card-only allowlist.
    },
    { idempotencyKey: `qualia-checkout-${quote.attempt_id}` },
  );
  if (!session.url) throw new Error("Checkout did not return a payment link.");
  return { session, url: stripeRedirectUrl(session.url, "checkout") };
}

export async function retrieveRecipient(
  stripe: Stripe,
  accountId: string,
  environment: PaymentEnvironment,
) {
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient", "requirements"],
  });
  assertMode(account.livemode, environment);
  return account;
}

export async function createRecipient(
  stripe: Stripe,
  input: { hostId: string; operationId: string; email: string; displayName: string },
) {
  return stripe.v2.core.accounts.create(
    {
      contact_email: input.email,
      display_name: input.displayName,
      identity: { country: "us" },
      dashboard: "express",
      defaults: {
        currency: "usd",
        responsibilities: { fees_collector: "application", losses_collector: "application" },
      },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      metadata: { qualia_host_id: input.hostId, qualia_operation_id: input.operationId },
    },
    { idempotencyKey: `qualia-account-${input.operationId}` },
  );
}

export async function createOnboardingLink(stripe: Stripe, accountId: string, siteUrl: string) {
  const link = await stripe.v2.core.accountLinks.create(
    {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          return_url: `${siteUrl}/host/payments/return`,
          refresh_url: `${siteUrl}/host/payments/refresh`,
          collection_options: { fields: "eventually_due" },
        },
      },
    },
    { idempotencyKey: `qualia-onboarding-link-${randomUUID()}` },
  );
  return stripeRedirectUrl(link.url, "connect");
}
