import Link from "next/link";
import { getBookingDetails } from "@/lib/booking/data";
import { effectiveStatus, bookingStatusLabel } from "@/lib/booking/validation";
import { formatMoney, formatMiamiDate } from "@/lib/host/validation";
import { BookingActions } from "@/components/booking/booking-actions";
import { MessageThread } from "@/components/booking/message-thread";
import { getBookingParticipation, getBookingPartyParticipation } from "@/lib/participation/data";
import { ParticipationRulesSummary } from "@/components/booking/participation-rules";
import { bookingModeLabel, bookingPartyLabel, bookingPriceLabel } from "@/lib/booking/presentation";

export const metadata = { title: "Your booking" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [details, participation, party] = await Promise.all([
    getBookingDetails(id),
    getBookingParticipation(id),
    getBookingPartyParticipation(id),
  ]);
  const {
    booking,
    listing,
    host,
    guest_name: guestName,
    meeting_location: location,
    messages,
    userId,
  } = details;
  const isHost = booking.host_id === userId;
  const status = effectiveStatus(booking);
  const hasMinors = party
    ? party.members.some((member) => member.kind === "minor")
    : participation?.kind === "minor";
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
            <h2>Your experience</h2>
            <dl className="booking-details">
              <div>
                <dt>Booking format</dt>
                <dd>{bookingModeLabel(booking.booking_mode)}</dd>
              </div>
              <div>
                <dt>Your party</dt>
                <dd>{bookingPartyLabel(booking.party_size)}</dd>
              </div>
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
                <dt>Booking total</dt>
                <dd>{formatMoney(booking.amount_cents)}</dd>
              </div>
              <div>
                <dt>Pricing</dt>
                <dd>{bookingPriceLabel(booking)}</dd>
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
            <p className="muted">
              {booking.booking_mode === "shared"
                ? "Your reservation covers the guests in your party. Other parties may join this session."
                : "This session is reserved for your party only."}
            </p>
            {booking.guest_message ? (
              <div className="booking-original-note">
                <span className="eyebrow">Guest&apos;s request note</span>
                <p>{booking.guest_message}</p>
              </div>
            ) : null}
          </section>
          <section className="panel">
            <h2>Participant and activity requirements</h2>
            {participation ? (
              <div className="form-stack">
                <dl className="booking-details">
                  {party ? (
                    <>
                      {party.members.map((member, index) => (
                        <div key={index}>
                          <dt>Guest {index + 1}</dt>
                          <dd>
                            {member.kind === "guardian"
                              ? "Accompanying guardian"
                              : member.kind === "minor"
                                ? "Minor"
                                : "Adult"}
                            , age {member.age_at_experience} at the experience
                          </dd>
                        </div>
                      ))}
                      {party.members.length > 1 ? (
                        <div>
                          <dt>Permission to arrange this booking</dt>
                          <dd>
                            {party.group_authority_confirmed
                              ? "Confirmed by the booking adult"
                              : "Not recorded"}
                          </dd>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>Participant</dt>
                        <dd>
                          {participation.kind === "minor"
                            ? "Minor, booked by a parent or legal guardian"
                            : "Adult account holder"}
                        </dd>
                      </div>
                      <div>
                        <dt>Age at the experience</dt>
                        <dd>{participation.age_at_experience}</dd>
                      </div>
                    </>
                  )}
                  {hasMinors ? (
                    <>
                      <div>
                        <dt>Guardian authority</dt>
                        <dd>
                          {participation.guardian_authority_confirmed
                            ? "Confirmed by the booking adult"
                            : "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt>Guardian presence</dt>
                        <dd>
                          {participation.rules_snapshot.guardian_presence === "required"
                            ? "Required throughout the experience"
                            : "Not required; follow the approved supervision plan"}
                        </dd>
                      </div>
                      <div>
                        <dt>Supervision acknowledgment</dt>
                        <dd>
                          {participation.guardian_presence_accepted ? "Recorded" : "Not recorded"}
                        </dd>
                      </div>
                    </>
                  ) : null}
                  <div>
                    <dt>Requirements acknowledged</dt>
                    <dd>
                      <time dateTime={participation.accepted_at}>
                        {formatMiamiDate(participation.accepted_at)}
                      </time>{" "}
                      · revision {participation.rules_snapshot.revision}
                    </dd>
                  </div>
                </dl>
                <p className="muted">
                  These are the activity requirements recorded when the request was made. The
                  booking adult must share them with everyone in their party. This acknowledgment is
                  not a liability waiver or consent on another adult&apos;s behalf.
                </p>
                <ParticipationRulesSummary rules={participation.rules_snapshot} />
              </div>
            ) : (
              <p className="notice">
                This earlier booking has no recorded participation confirmation. Contact Qualia to
                review the participant and activity requirements before the experience.
              </p>
            )}
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
