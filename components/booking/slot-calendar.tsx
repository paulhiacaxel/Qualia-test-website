"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { requestBooking } from "@/app/bookings/actions";
import { formatMoney } from "@/lib/host/validation";
import { formatSlotTime, type calendarMonth } from "@/lib/booking/validation";
import type { BookingActionState, BookingPolicy, BookingSlot } from "@/lib/booking/types";

function RequestButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary full-width" type="submit" disabled={pending || disabled}>
      {pending ? "Sending request…" : "Request this time"}
    </button>
  );
}

export function SlotCalendar({
  listingId,
  calendar,
  slots,
  policy,
  signedIn,
  isOwner,
  priceCents,
}: {
  listingId: string;
  calendar: ReturnType<typeof calendarMonth> & { selectedDate: string; scheduledDates: string[] };
  slots: BookingSlot[];
  policy: BookingPolicy;
  signedIn: boolean;
  isOwner: boolean;
  priceCents: number;
}) {
  const [selected, setSelected] = useState("");
  const [state, action] = useActionState<BookingActionState, FormData>(requestBooking, {});
  const scheduledDays = new Set(calendar.scheduledDates);
  const canRequest = Boolean(policy?.enabled && signedIn && !isOwner);
  return (
    <div className="slot-picker">
      <div className="booking-price">
        {formatMoney(priceCents)} <small>/ session</small>
      </div>
      <p className="booking-price-note">For one guest · Miami time</p>
      <div className="calendar-heading">
        <h2>{calendar.label}</h2>
        <div className="calendar-controls">
          {calendar.previous ? (
            <Link
              href={`/experiences/${listingId}?month=${calendar.previous}#booking`}
              aria-label="Previous month"
            >
              ←
            </Link>
          ) : (
            <span aria-hidden="true">←</span>
          )}
          {calendar.next ? (
            <Link
              href={`/experiences/${listingId}?month=${calendar.next}#booking`}
              aria-label="Next month"
            >
              →
            </Link>
          ) : (
            <span aria-hidden="true">→</span>
          )}
        </div>
      </div>
      <div
        className="booking-calendar"
        role="group"
        aria-label={`Choose a scheduled date in ${calendar.label}`}
      >
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((weekday) => (
          <span key={weekday} className="calendar-weekday">
            {weekday}
          </span>
        ))}
        {Array.from({ length: calendar.firstWeekday }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: calendar.days }, (_, index) => {
          const date = `${calendar.value}-${String(index + 1).padStart(2, "0")}`;
          return scheduledDays.has(date) ? (
            <Link
              key={date}
              className={`calendar-date ${calendar.selectedDate === date ? "selected" : ""}`}
              href={`/experiences/${listingId}?month=${calendar.value}&date=${date}#booking`}
              aria-current={calendar.selectedDate === date ? "date" : undefined}
              aria-label={`${calendar.label} ${index + 1}, check available times`}
            >
              {index + 1}
            </Link>
          ) : (
            <span className="calendar-date unavailable" key={date}>
              {index + 1}
            </span>
          );
        })}
      </div>
      {!slots.length ? (
        <p className="booking-empty">
          {scheduledDays.size
            ? "No bookable times remain on this date. Choose another date."
            : "No scheduled dates this month. Try another month."}
        </p>
      ) : null}
      <form action={action} className="form-stack booking-request-form">
        <input type="hidden" name="listingId" value={listingId} />
        {slots.length ? (
          <fieldset className="unstyled-fieldset">
            <legend className="field-label">Choose a start time — Miami time</legend>
            {slots.length > 24 ? (
              <select
                className="field-input"
                name="startsAt"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                required
                disabled={!canRequest}
                aria-label="Available start time"
              >
                <option value="">Choose a time</option>
                {slots.map((slot) => (
                  <option key={slot.starts_at} value={slot.starts_at}>
                    {formatSlotTime(slot.starts_at)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="slot-options">
                {slots.map((slot) => (
                  <label
                    key={slot.starts_at}
                    className={`slot-option ${selected === slot.starts_at ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="startsAt"
                      value={slot.starts_at}
                      checked={selected === slot.starts_at}
                      onChange={() => setSelected(slot.starts_at)}
                      required
                      disabled={!canRequest}
                    />
                    <span>{formatSlotTime(slot.starts_at)}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ) : null}
        {!policy?.enabled ? (
          <p className="notice">Booking requests aren&apos;t open yet. Please check back soon.</p>
        ) : isOwner ? (
          <p className="notice">
            This is your experience.{" "}
            <Link className="text-link" href="/host/calendar">
              Manage your calendar
            </Link>
            .
          </p>
        ) : !signedIn ? (
          <div className="form-stack">
            <p className="booking-helper">Sign in to request a time with this host.</p>
            <Link
              className="btn btn-primary"
              href={`/login?next=${encodeURIComponent(`/experiences/${listingId}`)}`}
            >
              Sign in to request
            </Link>
          </div>
        ) : (
          <>
            <div>
              <label className="field-label" htmlFor="guest-message">
                A note for your host (optional)
              </label>
              <textarea
                className="field-input field-textarea"
                id="guest-message"
                name="guestMessage"
                rows={3}
                maxLength={3000}
                placeholder="What are you curious about? Share your experience level or a question."
              />
            </div>
            <label className="booking-checkbox">
              <input type="checkbox" name="requestConfirmed" required />I understand this is a
              request. The host must accept, and I must complete payment before the booking is
              confirmed.
            </label>
            {state.error ? (
              <p className="form-error" role="alert">
                {state.error}
              </p>
            ) : null}
            <RequestButton disabled={!selected} />
            <p className="booking-helper">You won&apos;t be charged when you send a request.</p>
          </>
        )}
      </form>
    </div>
  );
}
