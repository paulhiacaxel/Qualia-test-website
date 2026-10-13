import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";

// Exercise the actual orchestration and canonical normalization offline. These
// stubs are transport/ledger ports, not evidence of a signed provider delivery.
const control = {};
globalThis.__qualiaPaymentReconciliation = control;
const stub = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const runtime = stub(`export function paymentRuntime() {
  return globalThis.__qualiaPaymentReconciliation.runtime;
}`);
const store = stub(`export async function paymentCommand(name, args) {
  const state = globalThis.__qualiaPaymentReconciliation;
  state.commands.push({ name, args });
  return state.command(name, args);
}`);
const service = stub(`export async function syncRecipient(id) {
  const state = globalThis.__qualiaPaymentReconciliation;
  state.recipients.push(id);
  return state.readiness;
}`);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: stub("export{}"), shortCircuit: true };
    if (context.parentURL?.includes("/lib/payments/")) {
      const mocks = { "./client": runtime, "./store": store, "./service": service };
      if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
      if (specifier.startsWith("./") && !specifier.endsWith(".ts"))
        return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { processSnapshotEvent, processThinEvent, recoverCheckoutReference } =
  await import("../../lib/payments/webhooks.ts");
const { executeSettlement, executeRefundAndRecovery } =
  await import("../../lib/payments/settlement.ts");

const attempt = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const booking = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const reversal = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function session() {
  return {
    id: "cs_test_fixture",
    livemode: false,
    metadata: { qualia_attempt_id: attempt, qualia_booking_id: booking },
    client_reference_id: booking,
    amount_total: 10000,
    currency: "usd",
    status: "complete",
    payment_status: "paid",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    url: null,
    payment_intent: {
      id: "pi_fixture",
      status: "succeeded",
      amount_received: 10000,
      latest_charge: {
        id: "ch_fixture",
        paid: true,
        currency: "usd",
        balance_transaction: { fee: 320 },
      },
    },
  };
}
function event(type = "checkout.session.completed", overrides = {}) {
  return {
    id: "evt_fixture",
    type,
    livemode: false,
    data: { object: { id: "cs_test_fixture", metadata: { qualia_attempt_id: attempt } } },
    ...overrides,
  };
}
function operation(kind, overrides = {}) {
  return {
    operation_id: kind === "reversal" ? reversal : attempt,
    kind,
    state: "queued",
    environment: "sandbox",
    created_at: new Date().toISOString(),
    amount_cents: 2000,
    charge_id: "ch_fixture",
    payment_intent_id: "pi_fixture",
    destination: "acct_fixture",
    transfer_group: `qualia_booking_${booking}`,
    transfer_id: "tr_fixture",
    external_id: null,
    ...overrides,
  };
}
beforeEach(() => {
  control.commands = [];
  control.providerCalls = [];
  control.recipients = [];
  control.session = session();
  control.readiness = { transfersActive: true, payoutsActive: true, requirementsDue: false };
  control.command = async (name) =>
    name === "pay_ingest_event"
      ? { event_key: "sandbox:platform:evt_fixture", status: "new" }
      : null;
  control.runtime = {
    config: { environment: "sandbox", live: false },
    stripe: {
      checkout: {
        sessions: {
          retrieve: async (...args) => {
            control.providerCalls.push({ name: "checkout.retrieve", args });
            return control.session;
          },
          list: async (...args) => {
            control.providerCalls.push({ name: "checkout.list", args });
            return { data: [control.session] };
          },
        },
      },
      payouts: {
        retrieve: async (...args) => {
          control.providerCalls.push({ name: "payout.retrieve", args });
          return {
            id: "po_fixture",
            livemode: false,
            status: "failed",
            amount: 7930,
            currency: "usd",
            arrival_date: 1792000000,
          };
        },
      },
      refunds: {
        create: async (...args) => {
          control.providerCalls.push({ name: "refund.create", args });
          return { id: "re_fixture", status: "succeeded" };
        },
      },
      transfers: {
        create: async (...args) => {
          control.providerCalls.push({ name: "transfer.create", args });
          return { id: "tr_fixture", livemode: false };
        },
        createReversal: async (...args) => {
          control.providerCalls.push({ name: "reversal.create", args });
          throw new Error("Synthetic provider recovery failure");
        },
      },
    },
  };
});

test("async completion remains pending until canonical provider state is terminal", async () => {
  control.session.payment_status = "unpaid";
  control.session.payment_intent.status = "processing";
  control.session.payment_intent.latest_charge = null;
  await processSnapshotEvent(event(), false);
  assert.equal(
    control.commands.find((x) => x.name === "pay_apply_payment").args.p_state,
    "processing",
  );
  control.commands = [];
  control.session.payment_intent.status = "requires_payment_method";
  await processSnapshotEvent(event("checkout.session.async_payment_failed"), false);
  assert.equal(control.commands.find((x) => x.name === "pay_apply_payment").args.p_state, "failed");
  assert.deepEqual(control.providerCalls[0].args[1], {
    expand: ["payment_intent.latest_charge.balance_transaction"],
  });
});

test("out-of-order failure notification retrieves success instead of regressing the ledger", async () => {
  await processSnapshotEvent(
    event("payment_intent.payment_failed", {
      data: { object: { id: "pi_fixture", status: "requires_payment_method" } },
    }),
    false,
  );
  const applied = control.commands.find((x) => x.name === "pay_apply_payment").args;
  assert.equal(applied.p_state, "paid");
  assert.equal(applied.p_processor_fee_cents, 320);
  assert.deepEqual(
    control.providerCalls.map((x) => x.name),
    ["checkout.list", "checkout.retrieve"],
  );
});

test("an already-processed duplicate has no provider retrieval or second ledger application", async () => {
  control.command = async () => ({ event_key: "same-event", status: "processed" });
  await processSnapshotEvent(event(), false);
  assert.deepEqual(
    control.commands.map((x) => x.name),
    ["pay_ingest_event"],
  );
  assert.equal(control.providerCalls.length, 0);
});

test("a webhook racing ledger attachment records failure and the same event can retry", async () => {
  let unavailable = true;
  control.command = async (name) => {
    if (name === "pay_ingest_event")
      return { event_key: "same-event", status: unavailable ? "new" : "failed" };
    if (name === "pay_apply_payment" && unavailable)
      throw new Error("Synthetic missing attachment");
  };
  await assert.rejects(processSnapshotEvent(event(), false), /reconciliation failed/);
  assert.ok(control.commands.at(-1).args.p_error);
  unavailable = false;
  await processSnapshotEvent(event(), false);
  assert.equal(control.commands.at(-1).args.p_error, null);
  assert.ok(
    control.commands
      .filter((x) => x.name === "pay_apply_payment")
      .every((x) => x.args.p_event_key === "same-event"),
  );
});

test("mixed live mode and platform/connected routing fail before ledger ingestion", async () => {
  await assert.rejects(
    processSnapshotEvent(event(undefined, { livemode: true }), false),
    /environment mismatch/,
  );
  await assert.rejects(
    processSnapshotEvent(event(undefined, { account: "acct_fixture" }), false),
    /account context/,
  );
  await assert.rejects(processSnapshotEvent(event(), true), /account context/);
  assert.equal(control.commands.length, 0);
  assert.equal(control.providerCalls.length, 0);
});

test("connected payout state is retrieved in the correct account and cannot confirm a booking", async () => {
  await processSnapshotEvent(
    event("payout.paid", {
      account: "acct_fixture",
      data: { object: { id: "po_fixture", status: "paid" } },
    }),
    true,
  );
  assert.deepEqual(control.providerCalls[0].args, [
    "po_fixture",
    {},
    { stripeAccount: "acct_fixture" },
  ]);
  const payout = control.commands.find((x) => x.name === "pay_sync_payout").args;
  assert.equal(payout.p_state, "failed");
  assert.equal(payout.p_account_id, "acct_fixture");
  assert.equal(
    control.commands.some((x) => x.name === "pay_apply_payment"),
    false,
  );
});

test("thin capability notification refreshes the recipient instead of trusting its event hint", async () => {
  await processThinEvent({
    id: "evt_v2_fixture",
    livemode: false,
    type: "v2.core.account[configuration.recipient].capability_status_updated",
    related_object: { id: "acct_fixture" },
  });
  assert.deepEqual(control.recipients, ["acct_fixture"]);
  assert.equal(control.commands.at(-1).args.p_error, null);
});

test("lost Checkout response recovery requires exact booking ownership before attachment", async () => {
  control.session.metadata.qualia_booking_id = attempt;
  await assert.rejects(
    recoverCheckoutReference(attempt, booking, "cs_test_fixture"),
    /does not match/,
  );
  assert.equal(control.commands.length, 0);
  control.session.metadata.qualia_booking_id = booking;
  await recoverCheckoutReference(attempt, booking, "cs_test_fixture");
  assert.equal(control.commands[0].name, "pay_attach_checkout");
  assert.equal(control.commands[0].args.p_attempt_id, attempt);
  assert.equal(control.commands.find((x) => x.name === "pay_apply_payment").args.p_state, "paid");
});

test("restricted recipient blocks transfer creation after a fresh capability check", async () => {
  const original = { ...process.env };
  try {
    process.env.STRIPE_ENVIRONMENT = "sandbox";
    process.env.STRIPE_RESTRICTED_KEY = "rk_test_offline_fixture";
    control.readiness.payoutsActive = false;
    await assert.rejects(executeSettlement(operation("transfer")), /restricted/);
    assert.deepEqual(control.recipients, ["acct_fixture"]);
    assert.equal(control.providerCalls.length, 0);
  } finally {
    for (const key of ["STRIPE_ENVIRONMENT", "STRIPE_RESTRICTED_KEY"])
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
  }
});

test("a failed host recovery cannot cancel the guest refund and preserves its unknown operation", async () => {
  const result = await executeRefundAndRecovery(
    operation("refund", {
      reversal_operation: operation("reversal"),
    }),
  );
  assert.deepEqual(result, { refund: "succeeded", recovery: "unknown" });
  const records = control.commands.filter((x) => x.name === "pay_record_operation");
  assert.equal(records[0].args.p_state, "succeeded");
  assert.equal(records[0].args.p_external_id, "re_fixture");
  assert.equal(records[1].args.p_operation_id, reversal);
  assert.equal(records[1].args.p_state, "unknown");
  assert.equal(control.providerCalls[0].args[1].idempotencyKey, `qualia-refund-${attempt}`);
});
