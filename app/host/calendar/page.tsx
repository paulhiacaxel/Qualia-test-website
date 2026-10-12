import Link from "next/link";
import { HostNav } from "@/components/host/host-nav";
import { AvailabilityManager } from "@/components/host/availability-manager";
import { HostMonthCalendar } from "@/components/host/host-month-calendar";
import { CalendarBlockManager } from "@/components/host/calendar-block-manager";
import { BookingList } from "@/components/booking/booking-list";
import { getMyBookings } from "@/lib/booking/data";
import { getHostListings } from "@/lib/host/data";
import { getHostCalendarBlocks } from "@/lib/host/calendar-data";
import { requireHost } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { calendarMonth, effectiveStatus, miamiDateKey } from "@/lib/booking/validation";
import { firstValue } from "@/lib/auth/validation";
import type { AvailabilityWindow } from "@/lib/host/types";
import "@/components/booking/booking.css";
import "@/components/host/calendar.css";

export const metadata = { title: "Host calendar" };

export default async function HostCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireHost();
  const params = await searchParams;
  const calendar = calendarMonth(firstValue(params.month));
  const today = miamiDateKey(new Date().toISOString());
  const requestedDate = firstValue(params.date);
  const selectedDay = Number(requestedDate?.slice(8));
  const selectedDate =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate.startsWith(`${calendar.value}-`) &&
    selectedDay >= 1 &&
    selectedDay <= calendar.days
      ? requestedDate
      : today.startsWith(calendar.value)
        ? today
        : `${calendar.value}-01`;
  const supabase = await createClient();
  const [bookings, listings, windowsResult, { blocks, imports }] = await Promise.all([
    getMyBookings("host"),
    getHostListings(),
    supabase
      .from("availability_windows")
      .select("id,listing_id,starts_at,ends_at")
      .eq("host_id", user.id)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
    getHostCalendarBlocks(),
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
      <div className="host-calendar-overview" aria-label="Calendar overview">
        <div>
          <strong>{requests.length}</strong>
          <span>awaiting your response</span>
        </div>
        <div>
          <strong>
            {otherActive.filter((booking) => effectiveStatus(booking) === "confirmed").length}
          </strong>
          <span>upcoming confirmed experiences</span>
        </div>
        <div>
          <strong>
            {
              otherActive.filter((booking) => effectiveStatus(booking) === "awaiting_payment")
                .length
            }
          </strong>
          <span>awaiting guest payment</span>
        </div>
        <span className="calendar-time-zone">Miami · America/New_York</span>
      </div>
      <HostMonthCalendar
        calendar={calendar}
        selectedDate={selectedDate}
        today={today}
        bookings={active}
        windows={windows}
        blocks={blocks}
        listings={listings}
      />
      <p className="booking-helper">
        Pending requests hold time temporarily across your Qualia experiences. A booking is
        confirmed after payment. Open a booking to respond, message your guest or review
        cancellation options.
      </p>
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
      <CalendarBlockManager blocks={blocks} imports={imports} selectedDate={selectedDate} />
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
