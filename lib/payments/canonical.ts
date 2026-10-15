import type Stripe from "stripe";

/** The ledger only receives these normalized, provider-retrieved facts. */
export type CanonicalPayment = {
  attemptId: string;
  sessionId: string;
  intentId: string | null;
  chargeId: string | null;
  amountCents: number;
  currency: string;
  state: "processing" | "paid" | "failed" | "expired";
  processorFeeCents: number | null;
};

export function objectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

export function canonicalPayment(session: Stripe.Checkout.Session): CanonicalPayment {
  const attemptId = session.metadata?.qualia_attempt_id;
  if (!attemptId || !/^[0-9a-f-]{36}$/i.test(attemptId))
    throw new Error("Missing booking payment reference.");
  const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const transaction =
    charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  if (!Number.isSafeInteger(session.amount_total) || !session.currency)
    throw new Error("Incomplete payment total.");
  // An expanded intent is mandatory if one exists; don't infer success from a redirect.
  if (session.payment_intent && !intent) throw new Error("Payment details were not retrieved.");
  let state: CanonicalPayment["state"] = "processing";
  if (session.payment_status === "paid" && intent?.status === "succeeded" && charge?.paid)
    state = "paid";
  else if (
    session.status === "expired" &&
    (!intent || ["canceled", "requires_payment_method"].includes(intent.status))
  )
    state = "expired";
  // Expired Checkout does not prove its in-flight bank payment is terminal.
  // Incomplete successful/capturable/processing intent evidence keeps inventory held.
  else if (session.status === "complete" && intent?.status === "canceled") state = "failed";
  else if (session.status === "complete" && intent?.status === "requires_payment_method")
    state = "failed";
  if (
    state === "paid" &&
    (intent?.amount_received !== session.amount_total || charge?.currency !== session.currency)
  ) {
    throw new Error("Payment amount does not match the checkout.");
  }
  return {
    attemptId,
    sessionId: session.id,
    intentId: objectId(session.payment_intent),
    chargeId: charge?.id ?? null,
    amountCents: session.amount_total!,
    currency: session.currency,
    state,
    processorFeeCents: transaction?.fee ?? null,
  };
}

export function accountReadiness(account: Stripe.V2.Core.Account) {
  const capabilities = account.configuration?.recipient?.capabilities?.stripe_balance;
  return {
    transfersActive: !account.closed && capabilities?.stripe_transfers?.status === "active",
    payoutsActive: !account.closed && capabilities?.payouts?.status === "active",
    requirementsDue:
      account.requirements?.entries?.some((entry) =>
        ["currently_due", "past_due"].includes(entry.minimum_deadline?.status ?? ""),
      ) ?? false,
  };
}
