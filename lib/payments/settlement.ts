import "server-only";
import { paymentRuntime } from "./client";
import { operationSchema, type PaymentOperation } from "./contracts";
import { executeDurableOperation, type OperationResult } from "./operations-core";
import { paymentCommand } from "./store";
import { assertMode, paymentConfig } from "./config";
import { syncRecipient } from "./service";
import { objectId } from "./canonical";

function required(value: string | null | undefined): string {
  if (!value) throw new Error("Incomplete settlement instruction.");
  return value;
}

export async function executeSettlement(value: unknown) {
  const operation = operationSchema.parse(value);
  const { stripe, config } = paymentRuntime(true);
  if (operation.environment !== config.environment)
    throw new Error("Settlement environment mismatch.");
  if (operation.kind === "transfer" && !operation.external_id) {
    if (!paymentConfig()) throw new Error("New transfers are paused.");
    const readiness = await syncRecipient(required(operation.destination));
    if (!readiness.transfersActive || !readiness.payoutsActive)
      throw new Error("Host payment setup is restricted.");
  }
  const metadata = { qualia_operation_id: operation.operation_id };
  const options = { idempotencyKey: `qualia-${operation.kind}-${operation.operation_id}` };
  function refundState(status: string | null): OperationResult["state"] {
    return status === "succeeded"
      ? "succeeded"
      : ["failed", "canceled"].includes(status ?? "")
        ? "failed"
        : "pending";
  }
  return executeDurableOperation(operation, {
    async create() {
      if (operation.kind === "transfer") {
        const transfer = await stripe.transfers.create(
          {
            amount: operation.amount_cents,
            currency: "usd",
            destination: required(operation.destination),
            source_transaction: required(operation.charge_id),
            transfer_group: required(operation.transfer_group),
            metadata,
          },
          options,
        );
        assertMode(transfer.livemode, config.environment);
        return { id: transfer.id, state: "succeeded" };
      }
      if (operation.kind === "refund") {
        const refund = await stripe.refunds.create(
          {
            payment_intent: required(operation.payment_intent_id),
            amount: operation.amount_cents,
            metadata,
          },
          options,
        );
        return { id: refund.id, state: refundState(refund.status) };
      }
      const reversal = await stripe.transfers.createReversal(
        required(operation.transfer_id),
        { amount: operation.amount_cents, metadata },
        options,
      );
      return { id: reversal.id, state: "succeeded" };
    },
    async retrieve() {
      const id = required(operation.external_id);
      if (operation.kind === "transfer") {
        const transfer = await stripe.transfers.retrieve(id);
        assertMode(transfer.livemode, config.environment);
        if (
          transfer.amount !== operation.amount_cents ||
          transfer.metadata.qualia_operation_id !== operation.operation_id ||
          objectId(transfer.source_transaction) !== operation.charge_id ||
          objectId(transfer.destination) !== operation.destination
        )
          throw new Error("Transfer reconciliation mismatch.");
        return { id, state: "succeeded" };
      }
      if (operation.kind === "refund") {
        const refund = await stripe.refunds.retrieve(id);
        if (
          refund.amount !== operation.amount_cents ||
          refund.metadata?.qualia_operation_id !== operation.operation_id ||
          objectId(refund.payment_intent) !== operation.payment_intent_id ||
          objectId(refund.charge) !== operation.charge_id
        )
          throw new Error("Refund reconciliation mismatch.");
        return { id, state: refundState(refund.status) };
      }
      const reversal = await stripe.transfers.retrieveReversal(required(operation.transfer_id), id);
      if (
        reversal.amount !== operation.amount_cents ||
        reversal.metadata?.qualia_operation_id !== operation.operation_id
      )
        throw new Error("Recovery reconciliation mismatch.");
      return { id, state: "succeeded" };
    },
    async record(id, externalId, state, error) {
      await paymentCommand("pay_record_operation", {
        p_operation_id: id,
        p_external_id: externalId,
        p_state: state,
        p_error: error,
      });
    },
  });
}

/** Refund and host recovery are independent; failed recovery never cancels an owed refund. */
export async function executeRefundAndRecovery(value: unknown) {
  const operation: PaymentOperation = operationSchema.parse(value);
  const refund = await executeSettlement(operation);
  let recovery: string | null = null;
  if (operation.reversal_operation && refund.state !== "failed") {
    try {
      recovery = (await executeSettlement(operation.reversal_operation)).state;
    } catch {
      recovery = "unknown";
    }
  }
  return { refund: refund.state, recovery };
}
