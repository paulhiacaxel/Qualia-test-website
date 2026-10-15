import Link from "next/link";
import {
  calendarDay,
  calendarMonth,
  effectiveStatus,
  formatSlotTime,
  miamiDateKey,
} from "@/lib/booking/validation";
import type { BookingSummary } from "@/lib/booking/types";
import type { AvailabilityWindow, Listing } from "@/lib/host/types";
import type { HostCalendarBlock } from "@/lib/host/calendar-types";
import { bookingModeLabel, bookingPartyLabel } from "@/lib/booking/presentation";

type CalendarEvent = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
  detail: string;
  kind: "hours" | "held" | "confirmed" | "blocked";
  href?: string;
};

export function HostMonthCalendar({
  calendar,
  selectedDate,
  today,
  bookings,
  windows,
  blocks,
  listings,
}: {
  calendar: ReturnType<typeof calendarMonth>;
  selectedDate: string;
  today: string;
  bookings: BookingSummary[];
  windows: AvailabilityWindow[];
  blocks: HostCalendarBlock[];
  listings: Listing[];
}) {
  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
  const events: CalendarEvent[] = [
    ...windows.map((window): CalendarEvent => ({
      ...window,
      id: `hours-${window.id}`,
      kind: "hours",
      label: listingMap.get(window.listing_id)?.title ?? "Hosting hours",
      detail: `Saved hosting hours · ${listingMap.get(window.listing_id)?.status.replaceAll("_", " ") ?? "experience"}`,
      href: `/host/listings/${window.listing_id}/edit#availability`,
    })),
    ...bookings.map((booking): CalendarEvent => ({
      ...booking,
      id: `booking-${booking.id}`,
      kind: effectiveStatus(booking) === "confirmed" ? "confirmed" : "held",
      label: `${booking.guest_name} · ${booking.listing_title}`,
      detail: `${bookingModeLabel(booking.booking_mode)} · ${bookingPartyLabel(booking.party_size)} · ${
        effectiveStatus(booking) === "confirmed"
          ? "Confirmed booking"
          : effectiveStatus(booking) === "requested"
            ? "Request · waiting for you"
            : "Held · awaiting payment"
      }`,
      href: `/bookings/${booking.id}`,
    })),
    ...blocks.map((block): CalendarEvent => ({
      ...block,
      id: `block-${block.id}`,
      kind: "blocked",
      label: block.label || "Unavailable",
      detail:
        block.source === "ical"
          ? "Blocked · imported calendar snapshot"
          : "Blocked across all experiences",
      href: "#blocked-time",
    })),
  ];
  // Compare real Miami-day boundaries so overnight events also appear on the next day.
  const days = Array.from({ length: calendar.days }, (_, index) => {
    const date = `${calendar.value}-${String(index + 1).padStart(2, "0")}`;
    const bounds = calendarDay(date);
    return {
      date,
      day: index + 1,
      events: events.filter(
        (event) =>
          Date.parse(event.starts_at) < Date.parse(bounds.until) &&
          Date.parse(event.ends_at) > Date.parse(bounds.from),
      ),
    };
  });
  const selected = days.find((day) => day.date === selectedDate)!;
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedDate}T12:00:00Z`));
  const agenda = [...selected.events].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <section className="host-schedule panel" aria-labelledby="schedule-heading">
      <div className="calendar-section-heading">
        <div>
          <span className="eyebrow">All your experiences</span>
          <h2 id="schedule-heading">{calendar.label}</h2>
        </div>
        <div className="host-month-navigation">
          <Link className="text-link" href={`/host/calendar?date=${today}#schedule-heading`}>
            Today
          </Link>
          {calendar.previous ? (
            <Link
              className="calendar-arrow"
              href={`/host/calendar?month=${calendar.previous}#schedule-heading`}
              aria-label="Previous month"
            >
              ←
            </Link>
          ) : (
            <span className="calendar-arrow disabled" aria-hidden="true">
              ←
            </span>
          )}
          {calendar.next ? (
            <Link
              className="calendar-arrow"
              href={`/host/calendar?month=${calendar.next}#schedule-heading`}
              aria-label="Next month"
            >
              →
            </Link>
          ) : (
            <span className="calendar-arrow disabled" aria-hidden="true">
              →
            </span>
          )}
        </div>
      </div>
      <div className="host-schedule-legend" aria-label="Calendar key">
        <span data-kind="hours">Hosting hours</span>
        <span data-kind="held">Request / payment</span>
        <span data-kind="confirmed">Confirmed</span>
        <span data-kind="blocked">Blocked</span>
      </div>
      <div
        className="host-month-grid"
        role="group"
        aria-label={`Choose a date in ${calendar.label}`}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span className="host-month-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: calendar.firstWeekday }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {days.map((day) => {
          const counts = { hours: 0, held: 0, confirmed: 0, blocked: 0 };
          day.events.forEach((event) => counts[event.kind]++);
          const labels = [
            counts.hours ? `${counts.hours} hosting windows` : "",
            counts.held ? `${counts.held} requests or payments` : "",
            counts.confirmed ? `${counts.confirmed} confirmed bookings` : "",
            counts.blocked ? `${counts.blocked} blocks` : "",
          ].filter(Boolean);
          return (
            <Link
              key={day.date}
              href={`/host/calendar?month=${calendar.value}&date=${day.date}#day-agenda`}
              className={`host-month-day ${day.date === selectedDate ? "selected" : ""} ${day.date < today ? "past" : ""}`}
              aria-current={day.date === selectedDate ? "date" : undefined}
              aria-label={`${calendar.label} ${day.day}${day.date === today ? ", today" : ""}, ${labels.join(", ") || "nothing scheduled"}`}
            >
              <span className="host-month-day-number">
                {day.day}
                {day.date === today ? <span className="host-month-today">Today</span> : null}
              </span>
              <span className="host-month-markers">
                {(["confirmed", "held", "blocked", "hours"] as const).map((kind) =>
                  counts[kind] ? (
                    <span data-kind={kind} key={kind} aria-hidden="true">
                      <span className="host-month-dot" />
                      <span className="host-month-marker-label">
                        {counts[kind]}{" "}
                        {kind === "hours"
                          ? "windows"
                          : kind === "held"
                            ? "held"
                            : kind === "confirmed"
                              ? "booked"
                              : "blocked"}
                      </span>
                    </span>
                  ) : null,
                )}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="field-hint">
        Hosting hours are the windows you saved. Private bookings hold the whole session; shared
        bookings hold their guest places. Unpublished experiences are not bookable.
      </p>
      <div id="day-agenda" className="host-day-agenda" tabIndex={-1}>
        <div className="calendar-section-heading">
          <div>
            <span className="eyebrow">Selected day · Miami time</span>
            <h3>{dayLabel}</h3>
          </div>
          <Link className="btn btn-outline" href="#blocked-time">
            Block this date
          </Link>
        </div>
        {agenda.length ? (
          <ul>
            {agenda.map((event) => (
              <li key={event.id} data-kind={event.kind}>
                <div className="host-agenda-time">
                  <time dateTime={event.starts_at}>
                    {miamiDateKey(event.starts_at) < selectedDate
                      ? "Continues"
                      : formatSlotTime(event.starts_at)}
                  </time>
                  <span>
                    to{" "}
                    {miamiDateKey(event.ends_at) > selectedDate
                      ? "next day"
                      : formatSlotTime(event.ends_at)}
                  </span>
                </div>
                <div>
                  <span className="host-agenda-status">{event.detail}</span>
                  {event.href ? (
                    <Link href={event.href}>{event.label}</Link>
                  ) : (
                    <strong>{event.label}</strong>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="host-empty">
            No upcoming hours, blocks or bookings on this date. Add hosting hours below, or block a
            future date if you will be unavailable.
          </p>
        )}
      </div>
    </section>
  );
}
