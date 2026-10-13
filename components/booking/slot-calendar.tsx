"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { requestBooking } from "@/app/bookings/actions";
import { formatMoney } from "@/lib/host/validation";
import { formatSlotTime, type calendarMonth } from "@/lib/booking/validation";
import type {
  BookingActionState,
  BookingMode,
  BookingPolicy,
  BookingSlot,
} from "@/lib/booking/types";
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
  sharedPriceCents,
  privatePriceBasis,
  bookingFormat,
  bookingMode,
  maxGuests,
  partySize,
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
  sharedPriceCents: number | null;
  privatePriceBasis: "group" | "per_guest";
  bookingFormat: "private" | "shared" | "both";
  bookingMode: BookingMode;
  maxGuests: number;
  partySize: number;
  adultEligible: boolean;
  participationRules: ParticipationRules | null;
}) {
  const [selected, setSelected] = useState("");
  const [optionMode, setOptionMode] = useState(bookingMode);
  const [optionCount, setOptionCount] = useState(String(partySize));
  const choicesChanged = optionMode !== bookingMode || optionCount !== String(partySize);
  const [participantAges, setParticipantAges] = useState<string[]>(Array(partySize).fill(""));
  const [accompanyingGuardians, setAccompanyingGuardians] = useState<boolean[]>(
    Array(partySize).fill(false),
  );
  const [state, action] = useActionState<BookingActionState, FormData>(requestBooking, {});
  const scheduledDays = new Set(calendar.scheduledDates);
  const canRequest = Boolean(
    policy?.enabled &&
    signedIn &&
    !isOwner &&
    adultEligible &&
    participationRules &&
    !choicesChanged,
  );
  const hasMinor = participantAges.some((age) => age !== "" && Number(age) < 18);
  const agesComplete = participantAges.every((age) => age !== "" && /^\d+$/.test(age));
  const guardianSeatMissing =
    hasMinor &&
    participationRules?.guardian_presence === "required" &&
    !participantAges.some((age) => age !== "" && Number(age) >= 18);
  const selectedSlot = slots.find((slot) => slot.starts_at === selected);
  const perGuest = bookingMode === "shared" || privatePriceBasis === "per_guest";
  const unitPrice = bookingMode === "shared" ? (sharedPriceCents ?? 0) : priceCents;
  const totalPrice = selectedSlot?.price_cents ?? unitPrice * (perGuest ? partySize : 1);
  const calendarHref = (month: string, date?: string) => {
    const query = new URLSearchParams({ month, mode: bookingMode, guests: String(partySize) });
    if (date) query.set("date", date);
    return `/experiences/${listingId}?${query.toString()}#booking`;
  };
  const slotLabel = (slot: BookingSlot) =>
    `${formatSlotTime(slot.starts_at)}${bookingMode === "shared" ? ` · ${slot.remaining_seats} spaces available` : " · Private"}`;
  return (
    <div className="slot-picker">
      <div className="booking-price">
        {formatMoney(totalPrice)} <small>total</small>
      </div>
      <p className="booking-price-note">
        {bookingMode === "private" ? "Private experience" : "Shared experience"} · {partySize}{" "}
        {partySize === 1 ? "guest" : "guests"}
        {perGuest ? ` · ${formatMoney(unitPrice)} per guest` : " · Flat group price"}
      </p>
      <form
        action={`/experiences/${listingId}#booking`}
        method="get"
        className="form-stack booking-options-form"
      >
        <input type="hidden" name="month" value={calendar.value} />
        <input type="hidden" name="date" value={calendar.selectedDate} />
        <div>
          <label className="field-label" htmlFor="booking-mode">
            How would you like to join?
          </label>
          <select
            id="booking-mode"
            name="mode"
            className="field-input"
            value={optionMode}
            onChange={(event) => setOptionMode(event.target.value as BookingMode)}
          >
            {bookingFormat !== "shared" ? (
              <option value="private">Private — just your party</option>
            ) : null}
            {bookingFormat !== "private" ? (
              <option value="shared">Shared — join other guests</option>
            ) : null}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="booking-guests">
            Guests (required)
          </label>
          <input
            className="field-input"
            id="booking-guests"
            name="guests"
            type="number"
            min={1}
            max={maxGuests}
            step={1}
            value={optionCount}
            onChange={(event) => setOptionCount(event.target.value)}
            required
            aria-describedby="booking-guests-hint"
          />
          <p className="field-hint" id="booking-guests-hint">
            Up to {maxGuests} {maxGuests === 1 ? "guest" : "guests"}. Include everyone attending or
            boarding, including children and accompanying guardians. Apply changes to see times for
            your party.
          </p>
        </div>
        <button type="submit" className="btn btn-outline full-width">
          Update available times
        </button>
      </form>
      {choicesChanged ? (
        <p className="notice" role="status">
          Update available times to apply your new format or guest count. The price and times below
          are for your current selection.
        </p>
      ) : null}
      <p className="booking-helper">
        {bookingMode === "private"
          ? "Your party has the experience to yourselves."
          : "Your party joins the same session as other guests. Everyone attending or boarding needs a space, including accompanying guardians."}
      </p>
      <p className="booking-helper">
        Requests close 32 minutes before the start to leave time for payment. Request ahead so your
        host has time to respond.
      </p>
      <div className="calendar-heading">
        <h2>{calendar.label}</h2>
        <div className="calendar-controls">
          {calendar.previous ? (
            <Link href={calendarHref(calendar.previous)} aria-label="Previous month">
              ←
            </Link>
          ) : (
            <span aria-hidden="true">←</span>
          )}
          {calendar.next ? (
            <Link href={calendarHref(calendar.next)} aria-label="Next month">
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
              href={calendarHref(calendar.value, date)}
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
            ? "No times have enough availability for this party and format. Try another date or update your choices."
            : "No scheduled dates this month. Try another month."}
        </p>
      ) : null}
      <form action={action} className="form-stack booking-request-form">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="bookingMode" value={bookingMode} />
        <input type="hidden" name="partySize" value={partySize} />
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
                    {slotLabel(slot)}
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
                    <span>
                      {formatSlotTime(slot.starts_at)}
                      <small className="slot-capacity">
                        {bookingMode === "shared"
                          ? `${slot.remaining_seats} spaces available`
                          : "Private session"}
                      </small>
                    </span>
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
              <h3 id="participation-heading">Who is coming?</h3>
              <ParticipationRulesSummary rules={participationRules} />
              <p className="field-hint" id="participant-privacy">
                Enter each guest’s age in whole years on the experience date. Do not provide names,
                birth dates or medical information here.
              </p>
              {participantAges.map((age, index) => (
                <div key={index}>
                  <label className="field-label" htmlFor={`participant-age-${index}`}>
                    Guest {index + 1} — age on the experience date (required)
                  </label>
                  {participationRules.guardian_presence === "required" ? (
                    <label className="booking-checkbox">
                      <input
                        type="checkbox"
                        name={`participantGuardian${index}`}
                        checked={accompanyingGuardians[index]}
                        onChange={(event) =>
                          setAccompanyingGuardians((current) =>
                            current.map((value, member) =>
                              member === index ? event.target.checked : value,
                            ),
                          )
                        }
                      />
                      Accompanying guardian — not taking part
                    </label>
                  ) : null}
                  <input
                    className="field-input"
                    type="number"
                    inputMode="numeric"
                    id={`participant-age-${index}`}
                    name={`participantAge${index}`}
                    step={1}
                    min={accompanyingGuardians[index] ? 18 : participationRules.min_age}
                    max={accompanyingGuardians[index] ? 120 : participationRules.max_age}
                    value={age}
                    onChange={(event) =>
                      setParticipantAges((current) =>
                        current.map((value, member) =>
                          member === index ? event.target.value : value,
                        ),
                      )
                    }
                    required
                    aria-describedby="participant-privacy"
                  />
                </div>
              ))}
              {participationRules.guardian_presence === "required" ? (
                <p className="field-hint">
                  A required accompanying guardian must be included in your guest count, even for a
                  children’s activity. Guardians must be 18 or older and accompany a minor.{" "}
                  {perGuest
                    ? "The per-guest price applies to guardians too."
                    : "Guardians count toward the group maximum and are included in the flat group price."}
                </p>
              ) : null}
              {guardianSeatMissing ? (
                <p className="notice" role="status">
                  {maxGuests < 2 ? (
                    <>
                      This experience needs a capacity review before a minor and their required
                      guardian can attend.{" "}
                      <Link className="text-link" href="/contact">
                        Contact Qualia
                      </Link>{" "}
                      for help.
                    </>
                  ) : (
                    <>
                      Enter the accompanying adult’s age. If they are not yet included, increase
                      your guest count above and update available times. Select “Accompanying
                      guardian” if they are not taking part.
                    </>
                  )}
                </p>
              ) : null}
              {partySize > 1 ? (
                <label className="booking-checkbox">
                  <input type="checkbox" name="groupAuthorityConfirmed" required />I have permission
                  to arrange this booking for everyone in my party and will share the participation
                  requirements with them.
                </label>
              ) : null}
              <label className="booking-checkbox">
                <input type="checkbox" name="adultBookerConfirmed" required />I am 18 or older and
                am making this request from my own account.
              </label>
              {hasMinor ? (
                <>
                  <label className="booking-checkbox">
                    <input type="checkbox" name="guardianAuthorityConfirmed" required />I am the
                    parent or legally authorized guardian of every minor in this party and have
                    authority to arrange their participation.
                  </label>
                  <label className="booking-checkbox">
                    <input type="checkbox" name="guardianPresenceAccepted" required />
                    {participationRules.guardian_presence === "required"
                      ? "I will remain present for every minor throughout the experience and follow the supervision requirements above."
                      : "I understand guardian presence is not required for this activity and will follow the approved supervision arrangements above."}
                  </label>
                </>
              ) : null}
              <label className="booking-checkbox">
                <input type="checkbox" name="participationRulesAccepted" required />I have read the
                activity risks, equipment, prerequisites and supervision requirements above.
                Everyone taking part meets these requirements. Accompanying guardians will follow
                the supervision requirements, and I will share these rules with my party.
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
            {selectedSlot ? (
              <p className="booking-price-note">
                Request total: {formatMoney(selectedSlot.price_cents)} for {partySize}{" "}
                {partySize === 1 ? "guest" : "guests"}.{" "}
                {bookingMode === "shared"
                  ? `${selectedSlot.remaining_seats} spaces are currently available.`
                  : "A private booking reserves the whole session for your party."}
              </p>
            ) : null}
            <RequestButton
              disabled={choicesChanged || guardianSeatMissing || !selectedSlot || !agesComplete}
            />
            <p className="booking-helper">You won&apos;t be charged when you send a request.</p>
          </>
        )}
      </form>
    </div>
  );
}
