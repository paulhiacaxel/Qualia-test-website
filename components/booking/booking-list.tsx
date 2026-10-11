import Link from "next/link";
import { formatMiamiDate, formatMoney } from "@/lib/host/validation";
import { effectiveStatus, bookingStatusLabel } from "@/lib/booking/validation";
import type { BookingSummary } from "@/lib/booking/types";

export function BookingList({
  bookings,
  role,
}: {
  bookings: BookingSummary[];
  role: "guest" | "host";
}) {
  if (!bookings.length)
    return (
      <div className="panel booking-empty-state">
        <h2>
          {role === "host" ? "Your next guest starts here." : "Your next afternoon is waiting."}
        </h2>
        <p>
          {role === "host"
            ? "Booking requests will appear here when a guest chooses a time on a published experience."
            : "Your booking requests and confirmed experiences will appear here."}
        </p>
        <Link className="btn btn-primary" href={role === "host" ? "/host/dashboard" : "/discover"}>
          {role === "host" ? "Manage experiences" : "Discover experiences"}
        </Link>
      </div>
    );
  return (
    <div className="booking-list">
      {bookings.map((booking) => {
        const status = effectiveStatus(booking);
        return (
          <article className="panel booking-summary" key={booking.id}>
            <div>
              <span className={`status status-${status}`}>{bookingStatusLabel(booking)}</span>
              <h2>
                <Link href={`/bookings/${booking.id}`}>{booking.listing_title}</Link>
              </h2>
              <p>
                {role === "host" ? `Guest: ${booking.guest_name}` : `With ${booking.host_name}`} ·{" "}
                {booking.listing_city}
              </p>
              <p>
                <time dateTime={booking.starts_at}>{formatMiamiDate(booking.starts_at)}</time>
              </p>
            </div>
            <div className="booking-summary-action">
              <strong>{formatMoney(booking.amount_cents)}</strong>
              <span>
                {status === "awaiting_payment" && booking.payment_hold_active
                  ? "Payment status pending"
                  : status === "requested" || status === "awaiting_payment"
                    ? "Not yet paid"
                    : status === "confirmed" || status === "completed"
                      ? "Booking total"
                      : "Request total"}
              </span>
              <Link className="btn btn-outline btn-sm" href={`/bookings/${booking.id}`}>
                View booking
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
