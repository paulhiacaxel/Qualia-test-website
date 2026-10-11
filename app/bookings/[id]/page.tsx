import Link from "next/link";
import { getBookingDetails } from "@/lib/booking/data";
import { effectiveStatus, bookingStatusLabel } from "@/lib/booking/validation";
import { formatMoney, formatMiamiDate } from "@/lib/host/validation";
import { BookingActions } from "@/components/booking/booking-actions";
import { MessageThread } from "@/components/booking/message-thread";

export const metadata = { title: "Your booking" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const {
    booking,
    listing,
    host,
    guest_name: guestName,
    meeting_location: location,
    messages,
    userId,
  } = await getBookingDetails(id);
  const isHost = booking.host_id === userId;
  const status = effectiveStatus(booking);
  return (
    <main id="main-content" className="container dashboard">
      <Link className="experience-back" href={isHost ? "/host/calendar" : "/bookings"}>
        ← {isHost ? "Host calendar" : "My bookings"}
      </Link>
      <div className="booking-page-heading">
        <div>
          <span className={`status status-${status}`}>{bookingStatusLabel(booking)}</span>
          <h1>{listing.title}</h1>
          <p>{isHost ? `With guest ${guestName}` : `With ${host.display_name}`}</p>
        </div>
      </div>
      <div className="booking-detail-grid">
        <div className="booking-detail-main">
          <section className="panel">
            <h2>Your afternoon</h2>
            <dl className="booking-details">
              <div>
                <dt>Starts</dt>
                <dd>
                  <time dateTime={booking.starts_at}>{formatMiamiDate(booking.starts_at)}</time>
                </dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>
                  <time dateTime={booking.ends_at}>{formatMiamiDate(booking.ends_at)}</time>
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {listing.neighborhood}, {listing.city}
                </dd>
              </div>
              <div>
                <dt>Session total</dt>
                <dd>{formatMoney(booking.amount_cents)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {bookingStatusLabel(booking)}
                  {["requested", "awaiting_payment"].includes(status)
                    ? " · no confirmed booking yet"
                    : ""}
                </dd>
              </div>
            </dl>
            {booking.guest_message ? (
              <div className="booking-original-note">
                <span className="eyebrow">Guest&apos;s request note</span>
                <p>{booking.guest_message}</p>
              </div>
            ) : null}
          </section>
          <BookingActions booking={booking} isHost={isHost} />
          <section className="panel">
            <h2>Meeting details</h2>
            {location ? (
              <>
                <address className="meeting-address">
                  {location.address_line1}
                  <br />
                  {location.address_line2 ? (
                    <>
                      {location.address_line2}
                      <br />
                    </>
                  ) : null}
                  {listing.city}, FL {location.postal_code}
                </address>
                {location.meeting_instructions ? (
                  <p className="experience-prose">{location.meeting_instructions}</p>
                ) : null}
              </>
            ) : (
              <p>Exact meeting details become available after this booking is confirmed.</p>
            )}
          </section>
          <MessageThread
            bookingId={id}
            messages={messages}
            userId={userId}
            hostId={booking.host_id}
            hostName={host.display_name}
            guestName={guestName}
          />
        </div>
        <aside className="panel booking-help">
          {!isHost ? (
            <section style={{ marginBottom: 32 }}>
              <span className="eyebrow">Your host</span>
              <h2>{host.display_name}</h2>
              <p className="experience-prose">{host.bio}</p>
              <Link className="text-link" href={`/hosts/${booking.host_id}`}>
                View host profile
              </Link>
            </section>
          ) : null}
          <span className="eyebrow">A little help</span>
          <h2>Have a question?</h2>
          <p>
            Ask your {isHost ? "guest" : "host"} in the booking conversation. For an issue with
            Qualia, contact us and include this booking reference.
          </p>
          <code className="booking-reference">{booking.id}</code>
          <Link className="btn btn-outline btn-sm" href="/contact">
            Contact Qualia
          </Link>
          {["confirmed", "completed"].includes(status) ? (
            <p className="booking-helper">
              Need to change or cancel a paid booking? Contact Qualia for help with the applicable
              booking terms.
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
