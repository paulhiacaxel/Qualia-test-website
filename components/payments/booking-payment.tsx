"use client";

import { useActionState, useEffect, useState } from "react";
import { createBookingCheckout, reviewBookingPayment } from "@/lib/payments/actions";
import { formatMiamiDate, formatMoney } from "@/lib/host/validation";
import { checkoutWindow } from "@/lib/booking/payment-window";

export function BookingPaymentPanel({ bookingId }: { bookingId: string }) {
  const [review, reviewAction, reviewing] = useActionState(reviewBookingPayment, {});
  const [state, action, pending] = useActionState(createBookingCheckout, {});
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const window = review.terms ? checkoutWindow(review.terms, now) : null;
  return (
    <section className="panel">
      <h3>Complete your booking</h3>
      <p>Your host accepted. Your booking is confirmed after payment succeeds.</p>
      {window?.mode === "closed" ? (
        <p className="notice">
          There is not enough time left to open a new checkout. Contact Qualia, or cancel this
          unpaid request and choose a later time. No deadline has been extended.
        </p>
      ) : window?.mode === "reconciling" ? (
        <p className="notice">
          Your existing payment is being checked. This time stays reserved while its result is
          confirmed. Refresh the status shortly or contact Qualia; do not make another payment.
        </p>
      ) : null}
      {!review.terms || window?.mode === "closed" || window?.mode === "reconciling" ? (
        <form action={reviewAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button className="btn btn-primary" type="submit" disabled={reviewing}>
            {reviewing
              ? "Checking payment…"
              : review.terms
                ? "Refresh payment status"
                : "Review payment"}
          </button>
          {review.error ? (
            <p role="alert" className="form-error">
              {review.error}
            </p>
          ) : null}
        </form>
      ) : (
        <form action={action}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="policyId" value={review.terms.policy_id} />
          <p>
            <strong>Total: {formatMoney(review.terms.amount_cents)} USD</strong>
          </p>
          {window?.mode === "new" && window.openBy ? (
            <p className="field-hint">
              Start payment before {formatMiamiDate(window.openBy)}.{" "}
              {window.payBy ? `Complete payment by ${formatMiamiDate(window.payBy)}.` : ""}
            </p>
          ) : window?.payBy ? (
            <p className="field-hint">
              Your existing checkout can still be resumed. Complete payment by{" "}
              {formatMiamiDate(window.payBy)}.
            </p>
          ) : null}
          <h4>Cancellation terms</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{review.terms.cancellation_terms}</p>
          <p className="field-hint">Terms version: {review.terms.terms_version}</p>
          <label className="checkbox-label">
            <input type="checkbox" name="termsAccepted" required /> I agree to these cancellation
            terms for this booking.
          </label>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending
              ? "Opening secure checkout…"
              : window?.mode === "resume"
                ? "Resume secure payment"
                : "Continue to secure payment"}
          </button>
          {state.error ? (
            <p role="alert" className="form-error">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
