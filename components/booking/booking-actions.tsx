import { ActionForm } from "@/components/host/action-form";
import { respondToBooking, cancelUnpaidBooking } from "@/app/bookings/actions";
import { effectiveStatus } from "@/lib/booking/validation";
import { formatMiamiDate } from "@/lib/host/validation";
import type { Booking } from "@/lib/booking/types";
import { BookingPaymentPanel } from "@/components/payments/booking-payment";
import { hostCanAcceptPaymentWindow } from "@/lib/booking/payment-window";

export function BookingActions({ booking, isHost }: { booking: Booking; isHost: boolean }) {
  const status = effectiveStatus(booking);
  const canAccept = hostCanAcceptPaymentWindow(
    booking.starts_at,
    booking.policy_payment_deadline_minutes,
  );
  if (!["requested", "awaiting_payment"].includes(status)) return null;
  if (status === "awaiting_payment" && booking.payment_hold_active) {
    return (
      <section className="panel booking-action-panel">
        <h2>Checkout is in progress.</h2>
        <p>
          {isHost
            ? "The guest’s checkout is in progress. This time remains reserved while payment is being confirmed. The booking is not confirmed yet."
            : "This time remains reserved while checkout is in progress. Your booking is only confirmed after payment is verified."}
        </p>
        {!isHost ? <BookingPaymentPanel bookingId={booking.id} /> : null}
        <p className="booking-helper">
          Cancellation is temporarily unavailable while a payment could still complete. Contact
          Qualia if you need help.
        </p>
      </section>
    );
  }
  return (
    <section className="panel booking-action-panel">
      <h2>
        {status === "requested"
          ? isHost
            ? "A guest would like to join you."
            : "Your request is with the host."
          : "One more step: payment."}
      </h2>
      {status === "requested" ? (
        <>
          <p>
            {isHost
              ? "Review the time and the guest’s note. Accepting invites the guest to complete payment; it does not confirm a paid booking."
              : "Your host will review the request. You haven’t been charged."}
          </p>
          {booking.request_expires_at ? (
            <p className="booking-helper">
              Request expires {formatMiamiDate(booking.request_expires_at)}.
            </p>
          ) : null}
          {isHost ? (
            <div className="booking-decision-buttons">
              {canAccept ? (
                <ActionForm action={respondToBooking} label="Accept request">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="decision" value="accept" />
                </ActionForm>
              ) : (
                <p className="notice">
                  There is not enough time left to start payment. Decline this request or ask the
                  guest to request a later time.
                </p>
              )}
              <ActionForm action={respondToBooking} label="Decline request" danger>
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="decision" value="decline" />
              </ActionForm>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p>
            {isHost
              ? "You’ve accepted the request. The guest must finish checkout before the booking is confirmed."
              : "Your host has accepted. Complete payment before the deadline to confirm the booking."}
          </p>
          {booking.payment_deadline_at ? (
            <p className="booking-helper">
              Payment deadline: {formatMiamiDate(booking.payment_deadline_at)}.
            </p>
          ) : null}
          {!isHost ? <BookingPaymentPanel bookingId={booking.id} /> : null}
        </>
      )}
      <details className="booking-cancel">
        <summary>Cancel this unpaid request</summary>
        <ActionForm action={cancelUnpaidBooking} label="Cancel unpaid request" danger>
          <input type="hidden" name="bookingId" value={booking.id} />
          <label className="booking-checkbox">
            <input type="checkbox" name="cancelConfirmed" required />I want to cancel this request
            and release the time.
          </label>
        </ActionForm>
      </details>
    </section>
  );
}
