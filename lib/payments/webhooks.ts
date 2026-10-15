import "server-only";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { paymentRuntime } from "./client";
import { assertMode, type PaymentEnvironment } from "./config";
import { paymentCommand } from "./store";
import { objectId } from "./canonical";
import { retrievePayment } from "./gateway";
import { syncRecipient } from "./service";
import { operationSchema } from "./contracts";

function metadataOperationId(metadata: Stripe.Metadata | null | undefined) {
  const id = metadata?.qualia_operation_id;
  if (!id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new Error("Invalid operation metadata.");
  return id;
}

const checkoutEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
const paymentEvents = new Set(["payment_intent.succeeded", "payment_intent.payment_failed"]);
const refundEvents = new Set(["refund.created", "refund.updated", "refund.failed"]);
const disputeEvents = new Set([
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
]);
const payoutEvents = new Set([
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  "payout.reconciliation_completed",
]);
const accountEvents = new Set([
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[requirements].updated",
  "v2.core.account.closed",
]);

type Inbox = { event_key: string; status: string };
async function eventWork(
  input: {
    environment: PaymentEnvironment;
    context: string;
    id: string;
    type: string;
    objectId: string;
  },
  work: (key: string) => Promise<void>,
) {
  const entry = await paymentCommand<Inbox>("pay_ingest_event", {
    p_environment: input.environment,
    p_account_context: input.context,
    p_event_id: input.id,
    p_event_type: input.type,
    p_object_id: input.objectId,
  });
  if (entry.status === "processed") return;
  try {
    await work(entry.event_key);
    await paymentCommand("pay_finish_event", { p_event_key: entry.event_key, p_error: null });
  } catch {
    await paymentCommand("pay_finish_event", {
      p_event_key: entry.event_key,
      p_error: "Canonical Stripe reconciliation failed; retry required.",
    }).catch(() => undefined);
    throw new Error("Payment reconciliation failed.");
  }
}

async function applyCheckout(
  stripe: Stripe,
  environment: PaymentEnvironment,
  eventKey: string,
  sessionId: string,
) {
  const payment = await retrievePayment(stripe, sessionId, environment);
  await paymentCommand("pay_apply_payment", {
    p_event_key: eventKey,
    p_attempt_id: payment.attemptId,
    p_session_id: payment.sessionId,
    p_payment_intent_id: payment.intentId,
    p_charge_id: payment.chargeId,
    p_amount_cents: payment.amountCents,
    p_currency: payment.currency,
    p_state: payment.state,
    p_processor_fee_cents: payment.processorFeeCents,
  });
}

async function syncRefund(stripe: Stripe, environment: PaymentEnvironment, refundId: string) {
  const refund = await stripe.refunds.retrieve(refundId);
  const chargeId = objectId(refund.charge);
  if (!chargeId) throw new Error("Refund has no charge reference.");
  const charge = await stripe.charges.retrieve(chargeId);
  assertMode(charge.livemode, environment);
  const state =
    refund.status === "succeeded"
      ? "succeeded"
      : ["failed", "canceled"].includes(refund.status ?? "")
        ? "failed"
        : "pending";
  await paymentCommand("pay_sync_refund", {
    p_environment: environment,
    p_charge_id: chargeId,
    p_refund_id: refund.id,
    p_state: state,
    p_amount_cents: refund.amount,
    p_operation_id: metadataOperationId(refund.metadata),
  });
}

export async function processSnapshotEvent(event: Stripe.Event, connect: boolean) {
  const { stripe, config } = paymentRuntime(true);
  assertMode(event.livemode, config.environment);
  if (connect !== Boolean(event.account)) throw new Error("Unexpected Stripe account context.");
  const id = (event.data.object as { id: string }).id;
  if (!id) throw new Error("Missing Stripe object reference.");
  if (connect && !payoutEvents.has(event.type)) return;
  const supported =
    checkoutEvents.has(event.type) ||
    paymentEvents.has(event.type) ||
    refundEvents.has(event.type) ||
    disputeEvents.has(event.type) ||
    ["charge.refunded", "transfer.created", "transfer.reversed"].includes(event.type);
  if (!connect && !supported) return;
  await eventWork(
    {
      environment: config.environment,
      context: event.account ?? "platform",
      id: event.id,
      type: event.type,
      objectId: id,
    },
    async (key) => {
      if (connect) {
        const payout = await stripe.payouts.retrieve(id, {}, { stripeAccount: event.account! });
        assertMode(payout.livemode, config.environment);
        await paymentCommand("pay_sync_payout", {
          p_environment: config.environment,
          p_account_id: event.account!,
          p_payout_id: payout.id,
          p_state: payout.status,
          p_amount_cents: payout.amount,
          p_currency: payout.currency,
          p_arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
        });
      } else if (checkoutEvents.has(event.type)) {
        // Non-Qualia checkout traffic must not become a booking payment.
        const hint = event.data.object as Stripe.Checkout.Session;
        if (!hint.metadata?.qualia_attempt_id) return;
        await applyCheckout(stripe, config.environment, key, id);
      } else if (paymentEvents.has(event.type)) {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: id, limit: 10 });
        for (const session of sessions.data) {
          if (session.metadata?.qualia_attempt_id)
            await applyCheckout(stripe, config.environment, key, session.id);
        }
      } else if (refundEvents.has(event.type)) {
        await syncRefund(stripe, config.environment, id);
      } else if (event.type === "charge.refunded") {
        const refunds = stripe.refunds.list({ charge: id, limit: 100 });
        for await (const refund of refunds) await syncRefund(stripe, config.environment, refund.id);
      } else if (disputeEvents.has(event.type)) {
        const dispute = await stripe.disputes.retrieve(id);
        const chargeId = objectId(dispute.charge);
        if (!chargeId) throw new Error("Dispute has no charge.");
        const charge = await stripe.charges.retrieve(chargeId);
        assertMode(charge.livemode, config.environment);
        await paymentCommand("pay_sync_dispute", {
          p_environment: config.environment,
          p_charge_id: chargeId,
          p_dispute_id: id,
          p_state: dispute.status === "won" ? "won" : dispute.status === "lost" ? "lost" : "open",
          p_amount_cents: dispute.amount,
        });
      } else {
        const transfer = await stripe.transfers.retrieve(id);
        assertMode(transfer.livemode, config.environment);
        await paymentCommand("pay_sync_transfer", {
          p_environment: config.environment,
          p_transfer_id: id,
          p_amount_reversed: transfer.amount_reversed,
          p_operation_id: metadataOperationId(transfer.metadata),
          p_amount_cents: transfer.amount,
          p_charge_id: objectId(transfer.source_transaction),
          p_destination: objectId(transfer.destination),
        });
        if (transfer.amount_reversed > 0) {
          for await (const reversal of stripe.transfers.listReversals(transfer.id, {
            limit: 100,
          })) {
            const operationId = metadataOperationId(reversal.metadata);
            if (!operationId) continue;
            const op = operationSchema.parse(
              await paymentCommand("pay_get_operation", { p_operation_id: operationId }),
            );
            if (
              op.environment !== config.environment ||
              op.kind !== "reversal" ||
              op.transfer_id !== transfer.id ||
              op.amount_cents !== reversal.amount
            )
              throw new Error("Recovery reconciliation mismatch.");
            await paymentCommand("pay_record_operation", {
              p_operation_id: op.operation_id,
              p_external_id: reversal.id,
              p_state: "succeeded",
              p_error: null,
            });
          }
        }
      }
    },
  );
}

export async function processThinEvent(notification: Stripe.V2.Core.EventNotification) {
  const { config } = paymentRuntime(true);
  assertMode(notification.livemode, config.environment);
  if (!accountEvents.has(notification.type)) return;
  if (
    !("related_object" in notification) ||
    !notification.related_object ||
    !("id" in notification.related_object) ||
    !notification.related_object.id
  )
    throw new Error("Missing connected account reference.");
  const accountId = notification.related_object.id;
  await eventWork(
    {
      environment: config.environment,
      context: accountId,
      id: notification.id,
      type: notification.type,
      objectId: accountId,
    },
    async () => {
      // A signature authenticates the notification; retrieval supplies current capability state.
      await syncRecipient(accountId);
    },
  );
}

/** Admin recovery path for lost delivery; only canonical provider data can confirm payment. */
export async function reconcileCheckout(sessionId: string, expire = false) {
  const { stripe, config } = paymentRuntime(true);
  let session = await stripe.checkout.sessions.retrieve(sessionId);
  assertMode(session.livemode, config.environment);
  if (expire && session.status === "open") {
    session = await stripe.checkout.sessions.expire(
      sessionId,
      {},
      { idempotencyKey: `qualia-expire-${sessionId}` },
    );
  }
  await eventWork(
    {
      environment: config.environment,
      context: "platform",
      id: `reconcile_${randomUUID()}`,
      type: "qualia.checkout.reconcile",
      objectId: session.id,
    },
    async (key) => {
      await applyCheckout(stripe, config.environment, key, session.id);
    },
  );
}

export async function readWebhookBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing webhook body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1024 * 1024) {
      await reader.cancel();
      throw new Error("Webhook body exceeds limit.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Recover a known provider session after a successful API call whose DB attachment was lost. */
export async function recoverCheckoutReference(
  attemptId: string,
  bookingId: string,
  sessionId: string,
) {
  const { stripe, config } = paymentRuntime(true);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  assertMode(session.livemode, config.environment);
  if (
    session.metadata?.qualia_attempt_id !== attemptId ||
    session.metadata.qualia_booking_id !== bookingId ||
    session.client_reference_id !== bookingId
  )
    throw new Error("Checkout recovery reference does not match.");
  await paymentCommand("pay_attach_checkout", {
    p_attempt_id: attemptId,
    p_session_id: session.id,
    p_payment_intent_id: objectId(session.payment_intent),
    p_url: session.url,
    p_expires_at: new Date(session.expires_at * 1000).toISOString(),
  });
  await reconcileCheckout(session.id);
}
