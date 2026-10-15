/** Provider-independent saga runner. A transport error is unknown, not a failure. */
export type SettlementOperation = {
  operation_id: string;
  kind: "transfer" | "refund" | "reversal";
  state: "queued" | "pending" | "succeeded" | "failed" | "unknown";
  created_at: string;
  external_id?: string | null;
};
export type OperationResult = { id: string; state: "pending" | "succeeded" | "failed" };
export type OperationPort = {
  create(operation: SettlementOperation): Promise<OperationResult>;
  retrieve(operation: SettlementOperation): Promise<OperationResult>;
  record(
    operationId: string,
    externalId: string | null,
    state: string,
    error: string | null,
  ): Promise<void>;
};

export async function executeDurableOperation(
  operation: SettlementOperation,
  port: OperationPort,
  now = Date.now(),
) {
  if (operation.state === "succeeded")
    return { state: "succeeded", id: operation.external_id ?? null };
  // An external ID permits safe canonical retrieval even after key expiry.
  if (!operation.external_id) {
    const created = Date.parse(operation.created_at);
    if (!Number.isFinite(created) || now - created > 23 * 3600000 || created > now + 60000) {
      throw new Error(
        "Reconcile this operation in Stripe before retrying. Its safe creation window has ended.",
      );
    }
  }
  let result: OperationResult | undefined;
  try {
    result = operation.external_id ? await port.retrieve(operation) : await port.create(operation);
    await port.record(operation.operation_id, result.id, result.state, null);
    return result;
  } catch {
    // Retain a returned ID if the network succeeded but our DB commit failed.
    await port
      .record(
        operation.operation_id,
        result?.id ?? operation.external_id ?? null,
        "unknown",
        "Provider result needs reconciliation.",
      )
      .catch(() => undefined);
    throw new Error("The result is not confirmed. Reconcile this same operation before retrying.");
  }
}
