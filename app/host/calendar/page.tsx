import Link from "next/link";
import { HostNav } from "@/components/host/host-nav";
import { AvailabilityManager } from "@/components/host/availability-manager";
import { BookingList } from "@/components/booking/booking-list";
import { getMyBookings } from "@/lib/booking/data";
import { getHostListings } from "@/lib/host/data";
import { requireHost } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  calendarMonth,
  effectiveStatus,
  formatSlotTime,
  miamiDateKey,
} from "@/lib/booking/validation";
import { firstValue } from "@/lib/auth/validation";
import type { AvailabilityWindow } from "@/lib/host/types";
import "@/components/booking/booking.css";

export const metadata = { title: "Host calendar" };

export default async function HostCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireHost();
  const params = await searchParams;
  const calendar = calendarMonth(firstValue(params.month));
  const supabase = await createClient();
  const [bookings, listings, windowsResult] = await Promise.all([
    getMyBookings("host"),
    getHostListings(),
    supabase
      .from("availability_windows")
      .select("id,listing_id,starts_at,ends_at")
      .eq("host_id", user.id)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);
  if (windowsResult.error) throw new Error("Your calendar could not be loaded.");
  const windows = (windowsResult.data ?? []) as AvailabilityWindow[];
  const active = bookings.filter(
    (booking) =>
      ["requested", "awaiting_payment", "confirmed"].includes(effectiveStatus(booking)) &&
      Date.parse(booking.ends_at) > Date.now(),
  );
  const requests = active.filter((booking) => effectiveStatus(booking) === "requested");
  const otherActive = active.filter((booking) => !requests.includes(booking));
  const history = bookings.filter((booking) => !active.includes(booking));
  return (
    <main id="main-content" className="container dashboard">
      <div className="host-page-heading">
        <div>
          <span className="eyebrow">Your time, thoughtfully planned</span>
          <h1>Calendar &amp; requests.</h1>
          <p>
            Review new requests, keep track of confirmed experiences, and choose when you&apos;re
            available. All dates use Miami time.
          </p>
        </div>
      </div>
      <HostNav current="calendar" />
      <section aria-label="Your host calendar">
        <div className="calendar-heading">
          <h2>{calendar.label}</h2>
          <div className="calendar-controls">
            {calendar.previous ? (
              <Link href={`/host/calendar?month=${calendar.previous}`} aria-label="Previous month">
                ←
              </Link>
            ) : null}
            {calendar.next ? (
              <Link href={`/host/calendar?month=${calendar.next}`} aria-label="Next month">
                →
              </Link>
            ) : null}
          </div>
        </div>
        <div className="host-calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <span className="calendar-weekday" key={weekday}>
              {weekday}
            </span>
          ))}
          {Array.from({ length: calendar.firstWeekday }, (_, index) => (
            <div key={`blank-${index}`} className="host-calendar-cell empty" />
          ))}
          {Array.from({ length: calendar.days }, (_, index) => {
            const date = `${calendar.value}-${String(index + 1).padStart(2, "0")}`;
            const dayBookings = active.filter(
              (booking) => miamiDateKey(booking.starts_at) === date,
            );
            return (
              <div className="host-calendar-cell" key={date}>
                <span>{index + 1}</span>
                {dayBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    data-pending={effectiveStatus(booking) !== "confirmed"}
                  >
                    {formatSlotTime(booking.starts_at)}
                    <br />
                    {booking.guest_name}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
        <p className="booking-helper">
          Pending requests hold time temporarily. Acceptance still requires the guest to pay before
          a booking is confirmed.
        </p>
      </section>
      {requests.length ? (
        <section className="booking-history">
          <h2>Waiting for your response ({requests.length})</h2>
          <BookingList bookings={requests} role="host" />
        </section>
      ) : null}
      <section className="booking-history">
        <h2>Upcoming experiences &amp; payments</h2>
        <BookingList bookings={otherActive} role="host" />
      </section>
      <section className="host-calendar-availability">
        <h2>When you can host</h2>
        <p className="muted">
          Add future times while your experience is being reviewed. Drafts and published experiences
          also allow removals, unless a window has an active request or booking.
        </p>
        {listings.length ? (
          listings.map((listing) => (
            <details className="panel calendar-listing" key={listing.id}>
              <summary>{listing.title}</summary>
              <div>
                <span className={`status status-${listing.status}`}>
                  {listing.status.replaceAll("_", " ")}
                </span>
                <AvailabilityManager
                  listingId={listing.id}
                  windows={windows.filter((window) => window.listing_id === listing.id)}
                  editable={["draft", "rejected", "published"].includes(listing.status)}
                  canAdd={listing.status !== "paused"}
                  durationMinutes={listing.duration_minutes}
                />
                {listing.status === "paused" ? (
                  <p className="booking-helper">
                    Availability is locked while this experience is paused.
                  </p>
                ) : null}
              </div>
            </details>
          ))
        ) : (
          <Link className="btn btn-outline" href="/host/listings/new">
            Create an experience
          </Link>
        )}
      </section>
      {history.length ? (
        <details className="panel calendar-listing booking-history">
          <summary>Past requests &amp; experiences ({history.length})</summary>
          <div>
            <BookingList bookings={history} role="host" />
          </div>
        </details>
      ) : null}
    </main>
  );
}
