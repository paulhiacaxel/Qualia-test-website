import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import {
  bookingMessageSchema,
  bookingRequestSchema,
  bookingRequestInput,
  bookingResponseSchema,
  bookingStatusLabel,
  calendarDay,
  calendarMonth,
  effectiveStatus,
  miamiDateKey,
} from "../../lib/booking/validation.ts";

const now = Temporal.Instant.from("2026-10-11T20:00:00Z");
const id = "f067be74-4ee2-4689-b5c6-80aa032a54c9";
const adultParticipant = {
  kind: "self",
  age_at_experience: 30,
  adult_booker_confirmed: true,
  rules_accepted: true,
  guardian_authority_confirmed: false,
  guardian_presence_accepted: false,
  rules_revision: 2,
};

test("month navigation remains in Miami time and rejects invalid or out-of-range months", () => {
  const month = calendarMonth("2026-11", now);
  assert.equal(month.days, 30);
  assert.equal(month.firstWeekday, 0);
  assert.equal(month.from, "2026-11-01T04:00:00Z");
  assert.equal(month.until, "2026-12-01T05:00:00Z");
  assert.equal(month.previous, "2026-10");
  assert.equal(month.next, "2026-12");
  for (const value of ["2026-02", "2026-99", "2029-01", "bad-date"]) {
    const fallback = calendarMonth(value, now);
    assert.equal(fallback.value, "2026-10");
    assert.equal(fallback.from, now.toString());
    assert.equal(fallback.previous, null);
  }
});

test("one-day slot queries preserve DST boundaries and remain below the 2,000-slot cap", () => {
  const spring = calendarDay("2027-03-14");
  const autumn = calendarDay("2026-11-01");
  assert.equal(spring.from, "2027-03-14T05:00:00Z");
  assert.equal(spring.until, "2027-03-15T04:00:00Z");
  assert.equal(autumn.from, "2026-11-01T04:00:00Z");
  assert.equal(autumn.until, "2026-11-02T05:00:00Z");
  assert.equal((Date.parse(spring.until) - Date.parse(spring.from)) / 3_600_000, 23);
  const longestDayMinutes = (Date.parse(autumn.until) - Date.parse(autumn.from)) / 60_000;
  assert.equal(longestDayMinutes, 1500);
  assert.ok(longestDayMinutes < 2000);
});

test("calendar end dates are exclusive and midnight conversion cannot move bookings to the wrong Miami day", () => {
  const decemberEnd = calendarDay("2026-12-31");
  const januaryStart = calendarDay("2027-01-01");
  assert.equal(decemberEnd.until, januaryStart.from);
  assert.equal(miamiDateKey("2026-11-02T04:59:59Z"), "2026-11-01");
  assert.equal(miamiDateKey("2026-11-02T05:00:00Z"), "2026-11-02");
  assert.throws(() => calendarDay("2026-02-30"));
});

test("expired request/payment holds stop being actionable at their exact deadlines", () => {
  const deadline = "2026-10-11T20:00:00Z";
  const atDeadline = Date.parse(deadline);
  const request = { status: "requested", request_expires_at: deadline, payment_deadline_at: null };
  const payment = {
    status: "awaiting_payment",
    request_expires_at: null,
    payment_deadline_at: deadline,
  };
  assert.equal(effectiveStatus(request, atDeadline - 1), "requested");
  assert.equal(effectiveStatus(request, atDeadline), "expired");
  assert.equal(effectiveStatus(payment, atDeadline), "expired");
  assert.equal(effectiveStatus({ ...payment, status: "confirmed" }, atDeadline), "confirmed");
  assert.equal(effectiveStatus({ ...request, status: "cancelled" }, atDeadline), "cancelled");
});

test("booking actions require UUIDs, unambiguous timestamps, bounded text, and valid host decisions", () => {
  const request = {
    listingId: id,
    startsAt: "2026-11-01T16:00:00Z",
    guestMessage: "  Hello!  ",
    participant: adultParticipant,
  };
  assert.equal(bookingRequestSchema.parse(request).guestMessage, "Hello!");
  assert.equal(
    bookingRequestSchema.safeParse({ ...request, listingId: "another-person" }).success,
    false,
  );
  assert.equal(
    bookingRequestSchema.safeParse({ ...request, startsAt: "2026-11-01T01:30:00" }).success,
    false,
  );
  assert.equal(
    bookingRequestSchema.safeParse({ ...request, guestMessage: "x".repeat(3001) }).success,
    false,
  );
  assert.equal(bookingMessageSchema.safeParse({ bookingId: id, body: " " }).success, false);
  assert.equal(
    bookingMessageSchema.safeParse({ bookingId: id, body: "Are materials included?" }).success,
    true,
  );
  assert.equal(
    bookingResponseSchema.safeParse({ bookingId: id, decision: "accept" }).success,
    true,
  );
  assert.equal(
    bookingResponseSchema.safeParse({ bookingId: id, decision: "confirm_paid" }).success,
    false,
  );
});

function requestForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    listingId: id,
    startsAt: "2026-11-01T16:00:00Z",
    guestMessage: "A first lesson",
    participantKind: "self",
    participantAge: "30",
    adultBookerConfirmed: "on",
    participationRulesAccepted: "on",
    rulesRevision: "2",
    ...overrides,
  }))
    if (value !== undefined) form.set(key, value);
  return form;
}

test("booking form cannot turn a missing age or rule revision into an accepted number", () => {
  assert.equal(bookingRequestSchema.safeParse(bookingRequestInput(requestForm())).success, true);
  for (const key of ["participantAge", "rulesRevision"]) {
    for (const value of [undefined, "", " ", "-1", "12.5", "1e1", "Infinity", "false"]) {
      const parsed = bookingRequestSchema.safeParse(
        bookingRequestInput(requestForm({ [key]: value })),
      );
      assert.equal(parsed.success, false, `${key}=${String(value)}`);
    }
  }
  assert.equal(
    bookingRequestSchema.safeParse(bookingRequestInput(requestForm({ rulesRevision: "0" })))
      .success,
    false,
  );
  assert.equal(
    bookingRequestSchema.safeParse(bookingRequestInput(requestForm({ participantAge: "121" })))
      .success,
    false,
  );
});

test("adult and minor bookings require the right explicit confirmations without child identity fields", () => {
  for (const key of ["adultBookerConfirmed", "participationRulesAccepted"]) {
    for (const value of [undefined, "", "true", "off"]) {
      assert.equal(
        bookingRequestSchema.safeParse(bookingRequestInput(requestForm({ [key]: value }))).success,
        false,
      );
    }
  }
  const minor = {
    participantKind: "minor",
    participantAge: "12",
    guardianAuthorityConfirmed: "on",
    guardianPresenceAccepted: "on",
  };
  assert.equal(
    bookingRequestSchema.safeParse(bookingRequestInput(requestForm(minor))).success,
    true,
  );
  for (const change of [
    { guardianAuthorityConfirmed: undefined },
    { guardianPresenceAccepted: undefined },
    { participantAge: "18" },
  ])
    assert.equal(
      bookingRequestSchema.safeParse(bookingRequestInput(requestForm({ ...minor, ...change })))
        .success,
      false,
    );
  assert.equal(
    bookingRequestSchema.safeParse(bookingRequestInput(requestForm({ participantAge: "17" })))
      .success,
    false,
  );
  const input = bookingRequestInput(
    requestForm({
      ...minor,
      childName: "Do not store",
      dateOfBirth: "2014-01-01",
      medicalInfo: "Do not store",
    }),
  );
  assert.deepEqual(Object.keys(input.participant).sort(), Object.keys(adultParticipant).sort());
  assert.equal("childName" in input, false);
  assert.equal(
    bookingRequestSchema.safeParse({
      ...input,
      participant: { ...input.participant, childName: "Do not store" },
    }).success,
    false,
  );
  assert.equal(
    bookingRequestSchema.safeParse({
      listingId: id,
      startsAt: "2026-11-01T16:00:00Z",
      guestMessage: "old client",
    }).success,
    false,
  );
});

test("in-flight checkout does not become expired or claim unpaid while payment can still settle", () => {
  const booking = {
    status: "awaiting_payment",
    request_expires_at: null,
    payment_deadline_at: "2026-10-11T19:00:00Z",
    payment_hold_active: true,
  };
  const afterDeadline = Date.parse("2026-10-11T20:00:00Z");
  assert.equal(effectiveStatus(booking, afterDeadline), "awaiting_payment");
  assert.equal(bookingStatusLabel(booking, afterDeadline), "Checkout in progress");
  assert.equal(
    effectiveStatus({ ...booking, payment_hold_active: false }, afterDeadline),
    "expired",
  );
  assert.equal(bookingStatusLabel({ ...booking, status: "confirmed" }, afterDeadline), "Confirmed");
});
