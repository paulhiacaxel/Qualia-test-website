"use client";

import { useActionState } from "react";
import { createBookingCheckout, reviewBookingPayment } from "@/lib/payments/actions";
import { formatMoney } from "@/lib/host/validation";

export function BookingPaymentPanel({ bookingId }: { bookingId: string }) {
  const [review, reviewAction, reviewing] = useActionState(reviewBookingPayment, {});
  const [state, action, pending] = useActionState(createBookingCheckout, {});
  return (
    <section className="panel">
      <h3>Complete your booking</h3>
      <p>Your host accepted. Your booking is confirmed after payment succeeds.</p>
      {!review.terms ? (
        <form action={reviewAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button className="btn btn-primary" type="submit" disabled={reviewing}>
            {reviewing ? "Loading terms…" : "Review payment"}
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
          <h4>Cancellation terms</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{review.terms.cancellation_terms}</p>
          <p className="field-hint">Terms version: {review.terms.terms_version}</p>
          <label className="checkbox-label">
            <input type="checkbox" name="termsAccepted" required /> I agree to these cancellation
            terms for this booking.
          </label>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Opening secure checkout…" : "Continue to secure payment"}
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
