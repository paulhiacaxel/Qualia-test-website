/** UI/server preflight only. The database and Stripe remain authoritative. */
export type CheckoutWindowInput = {
  booking_status: string;
  starts_at: string;
  payment_deadline_at: string | null;
  checkout_state: string | null;
  checkout_session_exists: boolean;
  checkout_expires_at: string | null;
};

export function checkoutWindow(input: CheckoutWindowInput, now = Date.now()) {
  const mode = (
    value: "new" | "resume" | "closed" | "reconciling",
    openBy: number | null,
    payBy: number | null,
  ) => ({
    mode: value,
    openBy: openBy !== null && Number.isFinite(openBy) ? new Date(openBy).toISOString() : null,
    payBy: payBy !== null && Number.isFinite(payBy) ? new Date(payBy).toISOString() : null,
  });
  const attemptExpiry = input.checkout_expires_at ? Date.parse(input.checkout_expires_at) : null;
  // An existing payment is never released based on the booking clock. Stripe's
  // actual session state is checked again when the guest follows the action.
  if (["processing", "paid", "quarantined"].includes(input.checkout_state ?? ""))
    return mode("reconciling", null, attemptExpiry);
  if (input.checkout_session_exists) {
    return mode(
      input.checkout_state === "open" && attemptExpiry !== null && attemptExpiry > now
        ? "resume"
        : "reconciling",
      null,
      attemptExpiry,
    );
  }
  const deadline = input.payment_deadline_at ? Date.parse(input.payment_deadline_at) : Number.NaN;
  const payBy = Math.min(Date.parse(input.starts_at), deadline, attemptExpiry ?? Infinity);
  // This matches the 31-minute gateway minimum, with a strict UI boundary so
  // users aren't offered a new creation that is already at the network cutoff.
  const openBy = payBy - 31 * 60_000;
  if (input.checkout_state === "preparing" && !(openBy > now))
    return mode("reconciling", openBy, payBy);
  return mode(
    input.booking_status === "awaiting_payment" && openBy > now ? "new" : "closed",
    openBy,
    payBy,
  );
}

export function hostCanAcceptPaymentWindow(
  startsAt: string,
  paymentMinutes: number | null | undefined,
  now = Date.now(),
) {
  return (
    typeof paymentMinutes === "number" &&
    paymentMinutes >= 32 &&
    Date.parse(startsAt) > now + 32 * 60_000
  );
}
