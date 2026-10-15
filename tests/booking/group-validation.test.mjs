import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingSelection,
  parseGuestCount,
  groupBookingRequestInput,
  groupBookingRequestSchema,
} from "../../lib/booking/validation.ts";

const id = "f067be74-4ee2-4689-b5c6-80aa032a54c9";
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    listingId: id,
    startsAt: "2026-11-01T16:00:00Z",
    guestMessage: "Hello!",
    bookingMode: "shared",
    partySize: "2",
    participantAge0: "31",
    participantAge1: "28",
    adultBookerConfirmed: "on",
    participationRulesAccepted: "on",
    groupAuthorityConfirmed: "on",
    rulesRevision: "2",
    ...overrides,
  }))
    if (value !== undefined) data.set(key, value);
  return data;
}
const parse = (overrides) =>
  groupBookingRequestSchema.safeParse(groupBookingRequestInput(form(overrides)));

test("URL guest filters accept only bounded whole counts and supported listing formats", () => {
  for (const invalid of [
    undefined,
    "",
    "0",
    "-1",
    "1.2",
    "51",
    "Infinity",
    "1e1",
    "2,booking_format.eq.shared",
    " 2 ",
  ]) {
    assert.equal(parseGuestCount(invalid), undefined, String(invalid));
  }
  assert.equal(parseGuestCount("1"), 1);
  assert.equal(parseGuestCount("50"), 50);
  assert.deepEqual(bookingSelection({ booking_format: "private", max_guests: 6 }, "shared", "4"), {
    bookingMode: "private",
    partySize: 4,
  });
  assert.deepEqual(bookingSelection({ booking_format: "shared", max_guests: 6 }, "private", "4"), {
    bookingMode: "shared",
    partySize: 4,
  });
  assert.deepEqual(bookingSelection({ booking_format: "both", max_guests: 6 }, "shared", "4"), {
    bookingMode: "shared",
    partySize: 4,
  });
  assert.deepEqual(bookingSelection({ booking_format: "both", max_guests: 6 }, "nonsense", "no"), {
    bookingMode: "private",
    partySize: 1,
  });
  assert.equal(
    bookingSelection({ booking_format: "both", max_guests: 6 }, "private", "50").partySize,
    6,
  );
});

test("every party member needs a valid age; parsing never invents ages or allocations", () => {
  assert.equal(parse().success, true);
  for (const invalid of [undefined, "", " ", "-1", "25.5", "1e1", "121"]) {
    assert.equal(parse({ participantAge1: invalid }).success, false, String(invalid));
  }
  for (const invalid of [undefined, "", "0", "-2", "51", "99999999999999", "2.5"]) {
    const input = groupBookingRequestInput(form({ partySize: invalid }));
    assert.equal(groupBookingRequestSchema.safeParse(input).success, false, String(invalid));
    assert.equal(input.participants.members.length, 0);
  }
  assert.equal(parse({ bookingMode: "both" }).success, false);
  assert.equal(parse({ groupAuthorityConfirmed: undefined }).success, false);
  const input = groupBookingRequestInput(form());
  assert.equal(groupBookingRequestSchema.safeParse({ ...input, partySize: 3 }).success, false);
});

test("a minor anywhere in the party requires guardian authority and supervision acceptance", () => {
  assert.equal(parse({ participantAge1: "12" }).success, false);
  const minors = {
    participantAge1: "12",
    guardianAuthorityConfirmed: "on",
    guardianPresenceAccepted: "on",
  };
  const result = parse(minors);
  assert.equal(result.success, true);
  assert.deepEqual(result.data.participants.members, [
    { kind: "adult", age_at_experience: 31 },
    { kind: "minor", age_at_experience: 12 },
  ]);
  for (const key of [
    "guardianAuthorityConfirmed",
    "guardianPresenceAccepted",
    "adultBookerConfirmed",
    "participationRulesAccepted",
  ]) {
    assert.equal(parse({ ...minors, [key]: undefined }).success, false);
  }
  assert.equal(parse({ ...minors, participantAge1: "0" }).success, true);
});

test("group form ignores client price and identity fields; only database quotes decide amounts", () => {
  const input = groupBookingRequestInput(
    form({
      amountCents: "1",
      participantName: "Do not store",
      dateOfBirth: "2000-01-01",
      hostId: id,
    }),
  );
  assert.equal("amountCents" in input, false);
  assert.equal("hostId" in input, false);
  assert.deepEqual(Object.keys(input.participants.members[0]).sort(), [
    "age_at_experience",
    "kind",
  ]);
  assert.equal(
    groupBookingRequestSchema.safeParse({
      ...input,
      participants: {
        ...input.participants,
        members: [
          { ...input.participants.members[0], name: "Do not store" },
          input.participants.members[1],
        ],
      },
    }).success,
    false,
  );
});

test("accompanying guardians remain counted members with adult ages and an explicit role", () => {
  const guardian = {
    participantGuardian0: "on",
    participantAge1: "12",
    guardianAuthorityConfirmed: "on",
    guardianPresenceAccepted: "on",
  };
  const input = groupBookingRequestInput(form(guardian));
  assert.equal(input.partySize, 2);
  assert.equal(input.participants.members.length, 2);
  assert.deepEqual(input.participants.members, [
    { kind: "guardian", age_at_experience: 31 },
    { kind: "minor", age_at_experience: 12 },
  ]);
  assert.equal(groupBookingRequestSchema.safeParse(input).success, true);
  assert.equal(parse({ ...guardian, participantAge0: "17" }).success, false);
  // Browser checkboxes only grant the guardian role with the exact submitted value.
  for (const value of [undefined, "off", "true"]) {
    const parsed = groupBookingRequestInput(form({ ...guardian, participantGuardian0: value }));
    assert.equal(parsed.participants.members[0].kind, "adult");
  }
});

test("one adult guest does not need a group authority acknowledgment", () => {
  assert.equal(parse({ partySize: "1", groupAuthorityConfirmed: undefined }).success, true);
});
