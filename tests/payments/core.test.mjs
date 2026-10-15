import test from "node:test";
import assert from "node:assert/strict";
import {
  paymentConfig,
  assertMode,
  stripeRedirectUrl,
  checkoutExpiry,
  assertCreationRetryWindow,
} from "../../lib/payments/config.ts";
import { canonicalPayment, accountReadiness } from "../../lib/payments/canonical.ts";
import { executeDurableOperation } from "../../lib/payments/operations-core.ts";
const now = Date.parse("2026-10-11T12:00:00Z");
const attempt = "d17d813c-3bd2-4aa1-b78d-f8f53b41f922";
function session(overrides = {}) {
  return {
    id: "cs_test_fixture",
    metadata: { qualia_attempt_id: attempt },
    amount_total: 12345,
    currency: "usd",
    status: "complete",
    payment_status: "paid",
    payment_intent: {
      id: "pi_fixture",
      status: "succeeded",
      amount_received: 12345,
      latest_charge: {
        id: "ch_fixture",
        paid: true,
        currency: "usd",
        balance_transaction: { fee: 388 },
      },
    },
    ...overrides,
  };
}
test("runtime fails closed across missing, mixed and disabled-live configuration", () => {
  assert.equal(paymentConfig({}), null);
  assert.equal(
    paymentConfig({ STRIPE_ENVIRONMENT: "sandbox", STRIPE_RESTRICTED_KEY: "rk_live_fixture" }),
    null,
  );
  assert.equal(
    paymentConfig({ STRIPE_ENVIRONMENT: "live", STRIPE_RESTRICTED_KEY: "rk_live_fixture" }),
    null,
  );
  assert.equal(
    paymentConfig({ STRIPE_ENVIRONMENT: "sandbox", STRIPE_RESTRICTED_KEY: "sk_test_fixture" }),
    null,
  );
  assert.equal(
    paymentConfig({ STRIPE_ENVIRONMENT: "sandbox", STRIPE_RESTRICTED_KEY: "rk_test_fixture" }).live,
    false,
  );
  // A pause must not prevent reconciliation and owed refunds on existing live charges.
  assert.equal(
    paymentConfig({ STRIPE_ENVIRONMENT: "live", STRIPE_RESTRICTED_KEY: "rk_live_fixture" }, true)
      .live,
    true,
  );
  assert.throws(() => assertMode(true, "sandbox"));
});
test("payment redirects reject impersonation, credentials and insecure links", () => {
  for (const url of [
    "https://checkout.stripe.com.evil.test/",
    "http://checkout.stripe.com/",
    "https://a@checkout.stripe.com/",
    "https://example.test/",
  ])
    assert.throws(() => stripeRedirectUrl(url, "checkout"));
  assert.equal(
    stripeRedirectUrl("https://checkout.stripe.com/c/pay/test", "checkout"),
    "https://checkout.stripe.com/c/pay/test",
  );
});
test("checkout and retry windows cannot extend expired authorizations", () => {
  assert.throws(() => checkoutExpiry(new Date(now + 30 * 60000).toISOString(), now));
  assert.equal(
    checkoutExpiry(new Date(now + 48 * 3600000).toISOString(), now),
    now / 1000 + 23 * 3600,
  );
  assert.throws(() => assertCreationRetryWindow(new Date(now - 24 * 3600000).toISOString(), now));
});
test("only retrieved matching successful intent and charge confirm payment", () => {
  assert.deepEqual(canonicalPayment(session()), {
    attemptId: attempt,
    sessionId: "cs_test_fixture",
    intentId: "pi_fixture",
    chargeId: "ch_fixture",
    amountCents: 12345,
    currency: "usd",
    state: "paid",
    processorFeeCents: 388,
  });
  assert.equal(canonicalPayment(session({ payment_intent: null })).state, "processing");
  assert.throws(() => canonicalPayment(session({ payment_intent: "pi_unexpanded" })));
  const mismatch = session();
  mismatch.payment_intent.amount_received = 100;
  assert.throws(() => canonicalPayment(mismatch));
});
test("a retryable card failure keeps an open checkout held; terminal expiration releases it", () => {
  const s = session({ status: "open", payment_status: "unpaid" });
  s.payment_intent.status = "requires_payment_method";
  assert.equal(canonicalPayment(s).state, "processing");
  s.status = "expired";
  assert.equal(canonicalPayment(s).state, "expired");
});
test("absent capabilities never imply payout readiness", () => {
  assert.deepEqual(accountReadiness({}), {
    transfersActive: false,
    payoutsActive: false,
    requirementsDue: false,
  });
});
const operation = {
  operation_id: attempt,
  kind: "refund",
  state: "queued",
  created_at: new Date(now).toISOString(),
  external_id: null,
};
test("network uncertainty is durably unknown, never falsely succeeded", async () => {
  const records = [];
  await assert.rejects(
    executeDurableOperation(
      operation,
      {
        create: async () => {
          throw Error("timeout");
        },
        retrieve: async () => {
          throw Error("unexpected");
        },
        record: async (...args) => records.push(args),
      },
      now,
    ),
  );
  assert.equal(records[0][2], "unknown");
  assert.equal(records[0][1], null);
});
test("provider ID is retained if database success commit fails", async () => {
  const records = [];
  await assert.rejects(
    executeDurableOperation(
      operation,
      {
        create: async () => ({ id: "re_fixture", state: "succeeded" }),
        retrieve: async () => {
          throw Error("unexpected");
        },
        record: async (...args) => {
          records.push(args);
          if (records.length === 1) throw Error("DB unavailable");
        },
      },
      now,
    ),
  );
  assert.equal(records[1][1], "re_fixture");
  assert.equal(records[1][2], "unknown");
});
test("known provider operation retrieves after 24 hours without a second mutation", async () => {
  let created = 0,
    retrieved = 0;
  const result = await executeDurableOperation(
    {
      ...operation,
      state: "unknown",
      external_id: "re_fixture",
      created_at: new Date(now - 48 * 3600000).toISOString(),
    },
    {
      create: async () => {
        created++;
        throw Error("must not create");
      },
      retrieve: async () => {
        retrieved++;
        return { id: "re_fixture", state: "succeeded" };
      },
      record: async () => {},
    },
    now,
  );
  assert.equal(result.state, "succeeded");
  assert.equal(created, 0);
  assert.equal(retrieved, 1);
});
test("unknown operation without provider ID cannot replay beyond retention", async () => {
  let calls = 0;
  await assert.rejects(
    executeDurableOperation(
      { ...operation, created_at: new Date(now - 24 * 3600000).toISOString() },
      {
        create: async () => {
          calls++;
        },
        retrieve: async () => {
          calls++;
        },
        record: async () => {},
      },
      now,
    ),
  );
  assert.equal(calls, 0);
});

test("expired Checkout cannot release an in-flight or incompletely expanded successful intent", () => {
  for (const status of ["processing", "succeeded", "requires_capture", "requires_action"]) {
    const s = session({ status: "expired", payment_status: "unpaid" });
    s.payment_intent.status = status;
    s.payment_intent.latest_charge = null;
    assert.equal(canonicalPayment(s).state, "processing");
  }
  assert.equal(
    canonicalPayment(session({ status: "expired", payment_status: "unpaid", payment_intent: null }))
      .state,
    "expired",
  );
});
