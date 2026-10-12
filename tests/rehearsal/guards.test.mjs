import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appEnvironment,
  assertEvidence,
  localStatus,
  processEnvironment,
  queryRows,
  sandboxSettings,
} from "../../scripts/rehearsal/guards.mjs";

const status = {
  API_URL: "http://127.0.0.1:55321",
  DB_URL: "postgresql://postgres:local@127.0.0.1:55322/postgres",
  PUBLISHABLE_KEY: "sb_publishable_local_fixture",
  SECRET_KEY: "sb_secret_local_fixture",
};
const secrets = {
  STRIPE_RESTRICTED_KEY: "rk_test_fixture",
  STRIPE_ENVIRONMENT: "sandbox",
  STRIPE_LIVE_PAYMENTS_ENABLED: "false",
  STRIPE_LIVE_ONBOARDING_ENABLED: "false",
  TRANSACTIONAL_EMAIL_ENABLED: "false",
  QUALIA_REHEARSAL_ISOLATED_SANDBOX: "true",
  QUALIA_REHEARSAL_STRIPE_PLATFORM_ID: "acct_isolatedTest",
  QUALIA_REHEARSAL_STRIPE_RECIPIENT_ID: "acct_recipientTest",
  STRIPE_WEBHOOK_SECRET_PLATFORM: "whsec_platform",
  STRIPE_WEBHOOK_SECRET_CONNECT: "whsec_connect",
  STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2: "whsec_thin",
};
test("rehearsal rejects hosted, ambiguous and non-dedicated database/API locations", () => {
  assert.equal(localStatus(status).api, status.API_URL);
  assert.equal(localStatus({ env: status }).secret, status.SECRET_KEY);
  for (const patch of [
    { API_URL: "https://example.supabase.co" },
    { API_URL: "http://127.0.0.1:54321" },
    { API_URL: "http://localhost:55321" },
    { API_URL: "http://evil@127.0.0.1:55321" },
    { DB_URL: "postgresql://postgres@remote:55322/postgres" },
    { DB_URL: "postgresql://postgres@127.0.0.1:54322/postgres" },
    { DB_URL: "postgresql://postgres@127.0.0.1:55322/postgres?host=remote" },
    { PUBLISHABLE_KEY: "legacy-jwt" },
    { SECRET_KEY: "sb_publishable_wrong" },
  ])
    assert.throws(() => localStatus({ ...status, ...patch }));
});
test("rehearsal refuses live keys/flags, production-connected sandbox and missing isolation acknowledgement", () => {
  assert.equal(sandboxSettings(secrets).platform, "acct_isolatedTest");
  for (const patch of [
    { STRIPE_RESTRICTED_KEY: "rk_live_fixture" },
    { STRIPE_RESTRICTED_KEY: "sk_test_fixture" },
    { STRIPE_ENVIRONMENT: "live" },
    { STRIPE_LIVE_PAYMENTS_ENABLED: "true" },
    { STRIPE_LIVE_ONBOARDING_ENABLED: "true" },
    { TRANSACTIONAL_EMAIL_ENABLED: "true" },
    { QUALIA_REHEARSAL_ISOLATED_SANDBOX: undefined },
    { QUALIA_REHEARSAL_STRIPE_PLATFORM_ID: "acct_1SKPOxDIzwThjgQA" },
    { QUALIA_REHEARSAL_STRIPE_RECIPIENT_ID: secrets.QUALIA_REHEARSAL_STRIPE_PLATFORM_ID },
    { STRIPE_WEBHOOK_SECRET_CONNECT: "" },
  ])
    assert.throws(() => sandboxSettings({ ...secrets, ...patch }));
});
test("child environment excludes inherited live providers, CLI overrides and booking email", () => {
  const dirty = {
    PATH: "/bin",
    SUPABASE_API_EXTERNAL_URL: "https://remote",
    RESEND_API_KEY: "secret",
    NEXT_PUBLIC_SITE_URL: "https://bookqualia.com",
    STRIPE_RESTRICTED_KEY: "rk_live_fixture",
    NODE_OPTIONS: "--require remote",
  };
  assert.deepEqual(processEnvironment(dirty), { PATH: "/bin" });
  const app = appEnvironment(dirty, secrets, localStatus(status));
  assert.equal(app.NEXT_PUBLIC_SITE_URL, "http://localhost:3000");
  assert.equal(app.NEXT_PUBLIC_SUPABASE_URL, status.API_URL);
  assert.equal(app.STRIPE_RESTRICTED_KEY, secrets.STRIPE_RESTRICTED_KEY);
  assert.equal(app.RESEND_API_KEY, "");
  assert.equal(app.TRANSACTIONAL_EMAIL_ENABLED, "false");
  assert.equal(app.NODE_OPTIONS, undefined);
});
test("CLI query parser fails closed on command tags, warnings, and changed envelopes", () => {
  assert.deepEqual(queryRows('{"rows":[{"matches":1}],"boundary":"untrusted"}'), [{ matches: 1 }]);
  for (const value of ["DO", "[]", '{"data":[]}', '{"rows":null}', 'warning\n{"rows":[]}'])
    assert.throws(() => queryRows(value));
});
const paid = {
  booking_status: "confirmed",
  environment: "sandbox",
  state: "paid",
  quarantine_reason: null,
  session_id: "cs_test_fixture",
  charge_id: "ch_fixture",
  payment_intent_id: "pi_fixture",
  amount_cents: 10000,
  received_amount_cents: 10000,
  received_currency: "usd",
  processor_fee_cents: 320,
  commission_bps: 1750,
  processed_payment_events: 1,
  failed_events: 0,
  pending_operations: 0,
  transfer_cents: 0,
  refund_cents: 0,
  reversal_cents: 0,
};
test("acceptance evidence requires authoritative payment, processed webhook and exact net settlement", () => {
  assert.doesNotThrow(() => assertEvidence(paid, "paid"));
  for (const patch of [
    { environment: "live" },
    { processed_payment_events: 0 },
    { failed_events: 1 },
    { processor_fee_cents: null },
    { received_amount_cents: 1 },
    { session_id: "cs_live_fixture" },
    { booking_status: "awaiting_payment" },
    { quarantine_reason: "hold" },
  ])
    assert.throws(() => assertEvidence({ ...paid, ...patch }, "paid"));
  const released = { ...paid, booking_status: "completed", transfer_cents: 7930 };
  assert.doesNotThrow(() => assertEvidence(released, "released"));
  assert.throws(() => assertEvidence({ ...released, transfer_cents: 7931 }, "released"));
  assert.doesNotThrow(() =>
    assertEvidence({ ...released, refund_cents: 2000, reversal_cents: 1650 }, "refunded"),
  );
  assert.throws(() =>
    assertEvidence({ ...released, refund_cents: 2000, reversal_cents: 1 }, "refunded"),
  );
  assert.throws(() =>
    assertEvidence(
      { ...released, refund_cents: 2000, reversal_cents: 1650, pending_operations: 1 },
      "refunded",
    ),
  );
  assert.doesNotThrow(() =>
    assertEvidence({ ...paid, booking_status: "cancelled", refund_cents: 10000 }, "refunded"),
  );
  assert.throws(() =>
    assertEvidence({ ...paid, booking_status: "cancelled", refund_cents: 1000 }, "refunded"),
  );
});
