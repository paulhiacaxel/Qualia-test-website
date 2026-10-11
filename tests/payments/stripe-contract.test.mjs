import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "../../lib/payments/config.ts";
// Test-only module resolution loads the actual server gateway with a fake HTTP transport.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (
      context.parentURL?.endsWith("/lib/payments/gateway.ts") &&
      ["./config", "./canonical"].includes(specifier)
    )
      return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { createCheckoutSession, createRecipient, createOnboardingLink } =
  await import("../../lib/payments/gateway.ts");
const attempt = "d17d813c-3bd2-4aa1-b78d-f8f53b41f922";
function transport(response) {
  const calls = [];
  const stripe = new Stripe("rk_test_fixture_only", {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (url, options) => {
      calls.push({ url, ...options });
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  });
  return { stripe, calls };
}
test("real SDK serializes hosted Checkout amount snapshot and stable idempotency without destination fees", async () => {
  const { stripe, calls } = transport({
    id: "cs_fixture",
    url: "https://checkout.stripe.com/c/pay/fixture",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
  const quote = {
    attempt_id: attempt,
    booking_id: attempt,
    host_id: attempt,
    guest_id: attempt,
    amount_cents: 12345,
    currency: "usd",
    title: "Private lesson",
    stripe_account_id: "acct_fixture",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date().toISOString(),
  };
  await createCheckoutSession(stripe, quote, "https://qualia.example");
  const body = new URLSearchParams(calls[0].body);
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "12345");
  assert.equal(body.get("payment_intent_data[metadata][qualia_attempt_id]"), attempt);
  assert.equal(body.get("payment_intent_data[transfer_group]"), `qualia_booking_${attempt}`);
  assert.equal(body.has("payment_intent_data[application_fee_amount]"), false);
  assert.equal(
    [...body.keys()].some((k) => /transfer_data|payment_method_types/.test(k)),
    false,
  );
  assert.equal(new Headers(calls[0].headers).get("idempotency-key"), `qualia-checkout-${attempt}`);
  assert.equal(new Headers(calls[0].headers).get("stripe-version"), STRIPE_API_VERSION);
});
test("real SDK Accounts v2 recipient requests Express and transfer capability without accepting host legal terms", async () => {
  const { stripe, calls } = transport({ id: "acct_fixture", livemode: false });
  await createRecipient(stripe, {
    hostId: attempt,
    operationId: attempt,
    email: "fixture@example.invalid",
    displayName: "Fixture",
  });
  const body = JSON.parse(calls[0].body);
  assert.equal(body.dashboard, "express");
  assert.equal(
    body.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested,
    true,
  );
  assert.equal(body.defaults.responsibilities.fees_collector, "application");
  assert.equal(body.defaults.responsibilities.losses_collector, "application");
  assert.equal(body.identity.entity_type, undefined);
  assert.equal(body.tos_acceptance, undefined);
  assert.equal(new Headers(calls[0].headers).get("idempotency-key"), `qualia-account-${attempt}`);
});
test("hosted onboarding uses recipient account and own return routes", async () => {
  const { stripe, calls } = transport({ url: "https://connect.stripe.com/setup/fixture" });
  assert.equal(
    await createOnboardingLink(stripe, "acct_fixture", "https://qualia.example"),
    "https://connect.stripe.com/setup/fixture",
  );
  const body = JSON.parse(calls[0].body);
  assert.equal(body.account, "acct_fixture");
  assert.equal(body.use_case.type, "account_onboarding");
  assert.equal(
    body.use_case.account_onboarding.return_url,
    "https://qualia.example/host/payments/return",
  );
});
test("SDK verifies raw signature and rejects changed payload and stale signatures", () => {
  const stripe = new Stripe("rk_test_fixture_only");
  const secret = "whsec_fixture_only";
  const payload = JSON.stringify({
    id: "evt_fixture",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_fixture" } },
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, header, secret).id, "evt_fixture");
  assert.throws(() => stripe.webhooks.constructEvent(`${payload} `, header, secret));
  const stale = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: 1 });
  assert.throws(() => stripe.webhooks.constructEvent(payload, stale, secret));
});
