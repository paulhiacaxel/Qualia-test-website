"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { requestBooking } from "@/app/bookings/actions";
import { formatMoney } from "@/lib/host/validation";
import { formatSlotTime, type calendarMonth } from "@/lib/booking/validation";
import type { BookingActionState, BookingPolicy, BookingSlot } from "@/lib/booking/types";
import type { ParticipationRules } from "@/lib/participation/types";
import { eligibilityPath } from "@/lib/auth/validation";
import { ParticipationRulesSummary } from "./participation-rules";

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
  adultEligible,
  participationRules,
}: {
  listingId: string;
  calendar: ReturnType<typeof calendarMonth> & { selectedDate: string; scheduledDates: string[] };
  slots: BookingSlot[];
  policy: BookingPolicy;
  signedIn: boolean;
  isOwner: boolean;
  priceCents: number;
  adultEligible: boolean;
  participationRules: ParticipationRules | null;
}) {
  const [selected, setSelected] = useState("");
  const [participantKind, setParticipantKind] = useState<"self" | "minor" | "">("");
  const [state, action] = useActionState<BookingActionState, FormData>(requestBooking, {});
  const scheduledDays = new Set(calendar.scheduledDates);
  const canRequest = Boolean(
    policy?.enabled && signedIn && !isOwner && adultEligible && participationRules,
  );
  const allowsAdult = Boolean(participationRules && participationRules.max_age >= 18);
  const allowsMinor = Boolean(participationRules && participationRules.min_age < 18);
  return (
    <div className="slot-picker">
      <div className="booking-price">
        {formatMoney(priceCents)} <small>/ session</small>
      </div>
      <p className="booking-price-note">For one participant · Miami time</p>
      <p className="booking-helper">
        Requests close 32 minutes before the start to leave time for payment. Request ahead so your
        host has time to respond.
      </p>
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
        {participationRules ? (
          <input type="hidden" name="rulesRevision" value={participationRules.revision} />
        ) : null}
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
        ) : !adultEligible ? (
          <div className="form-stack">
            <p className="booking-helper">
              Confirm that your account belongs to an adult before requesting a time.
            </p>
            <Link className="btn btn-primary" href={eligibilityPath(`/experiences/${listingId}`)}>
              Confirm account eligibility
            </Link>
          </div>
        ) : !participationRules ? (
          <p className="notice">
            The participation requirements for this experience are being reviewed. Requests will
            open when the review is complete.
          </p>
        ) : (
          <>
            <section aria-labelledby="participation-heading" className="form-stack">
              <h3 id="participation-heading">Who is taking part?</h3>
              <ParticipationRulesSummary rules={participationRules} />
              <fieldset className="unstyled-fieldset form-stack">
                <legend className="field-label">Choose the participant (required)</legend>
                {allowsAdult ? (
                  <label className="booking-checkbox">
                    <input
                      type="radio"
                      name="participantKind"
                      value="self"
                      checked={participantKind === "self"}
                      onChange={() => setParticipantKind("self")}
                      required
                    />
                    Myself — I will be 18 or older
                  </label>
                ) : null}
                {allowsMinor ? (
                  <label className="booking-checkbox">
                    <input
                      type="radio"
                      name="participantKind"
                      value="minor"
                      checked={participantKind === "minor"}
                      onChange={() => setParticipantKind("minor")}
                      required
                    />
                    A minor — I am their parent or legal guardian
                  </label>
                ) : null}
              </fieldset>
              {participantKind ? (
                <div key={participantKind}>
                  <label className="field-label" htmlFor="participant-age">
                    {participantKind === "self" ? "Your age" : "The minor’s age"} on the experience
                    date (required)
                  </label>
                  <input
                    className="field-input"
                    type="number"
                    inputMode="numeric"
                    id="participant-age"
                    name="participantAge"
                    step={1}
                    min={Math.max(participationRules.min_age, participantKind === "self" ? 18 : 0)}
                    max={Math.min(
                      participationRules.max_age,
                      participantKind === "minor" ? 17 : 120,
                    )}
                    required
                    aria-describedby="participant-privacy"
                  />
                  <p className="field-hint" id="participant-privacy">
                    Enter age in whole years on the selected experience date. Do not provide a
                    child&apos;s name, birth date or medical information.
                  </p>
                </div>
              ) : null}
              <label className="booking-checkbox">
                <input type="checkbox" name="adultBookerConfirmed" required />I am 18 or older and
                am making this request from my own account.
              </label>
              {participantKind === "minor" ? (
                <>
                  <label className="booking-checkbox">
                    <input type="checkbox" name="guardianAuthorityConfirmed" required />I am this
                    minor&apos;s parent or legal guardian and have authority to arrange their
                    participation.
                  </label>
                  <label className="booking-checkbox">
                    <input type="checkbox" name="guardianPresenceAccepted" required />
                    {participationRules.guardian_presence === "required"
                      ? "I will remain present throughout the experience and follow the supervision requirements above."
                      : "I understand guardian presence is not required for this activity and will follow the approved supervision arrangements above."}
                  </label>
                </>
              ) : null}
              <label className="booking-checkbox">
                <input type="checkbox" name="participationRulesAccepted" required />I have read the
                activity risks, equipment, prerequisites and supervision requirements above and will
                follow these participation rules.
              </label>
              <p className="field-hint">
                This confirms the activity requirements for this request. It is not a liability
                waiver.
              </p>
            </section>
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
                placeholder="Share an experience level or a question. Do not include a child’s name, birth date or medical details."
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
            <RequestButton disabled={!selected || !participantKind} />
            <p className="booking-helper">You won&apos;t be charged when you send a request.</p>
          </>
        )}
      </form>
    </div>
  );
}
