import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dollarsToCents,
  miamiLocalToUtc,
  validateAvailability,
  listingSchema,
  hostProfileSchema,
} from "../../lib/host/validation.ts";

test("booking prices preserve cents and reject ambiguous or out-of-range input", () => {
  assert.equal(dollarsToCents("0.29"), 29);
  assert.equal(dollarsToCents("150.01"), 15001);
  assert.equal(dollarsToCents("15.1"), 1510);
  for (const value of ["0", "-1", "1e3", "12.001", "Infinity", "100001", "$150"])
    assert.throws(() => dollarsToCents(value));
});

test("Miami times use the correct seasonal offset", () => {
  assert.equal(miamiLocalToUtc("2027-01-15T16:00"), "2027-01-15T21:00:00Z");
  assert.equal(miamiLocalToUtc("2027-07-15T16:00"), "2027-07-15T20:00:00Z");
});

test("nonexistent, ambiguous and invalid calendar times cannot create availability", () => {
  for (const value of ["2027-03-14T02:30", "2026-11-01T01:30", "2027-02-30T12:00", "tomorrow"])
    assert.throws(() => miamiLocalToUtc(value));
});

test("availability must be future, long enough, and bounded", () => {
  const now = Date.parse("2027-01-01T00:00:00Z");
  const valid = validateAvailability("2027-01-15T16:00", "2027-01-15T18:00", 120, now);
  assert.equal(valid.endsAt, "2027-01-15T23:00:00Z");
  assert.throws(() => validateAvailability("2026-12-01T16:00", "2026-12-01T18:00", 60, now));
  assert.throws(() => validateAvailability("2027-01-15T16:00", "2027-01-15T16:30", 60, now));
  assert.throws(() => validateAvailability("2027-01-15T16:00", "2027-01-17T18:00", 60, now));
});

test("listing and portfolio inputs stay within the launch geography and safe link schemes", () => {
  const listing = {
    title: "Personal painting",
    description: "A private session",
    category: "art",
    price: "150",
    durationMinutes: "120",
    city: "Miami",
    neighborhood: "The Roads",
  };
  assert.equal(listingSchema.parse(listing).price, 15000);
  assert.equal(listingSchema.safeParse({ ...listing, city: "New York" }).success, false);
  assert.equal(listingSchema.safeParse({ ...listing, category: "anything" }).success, false);
  const profile = {
    displayName: "Artist",
    bio: "My practice",
    city: "Miami",
    portfolioUrl: "https://artist.example",
  };
  assert.equal(hostProfileSchema.safeParse(profile).success, true);
  assert.equal(
    hostProfileSchema.safeParse({ ...profile, portfolioUrl: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    hostProfileSchema.safeParse({ ...profile, portfolioUrl: "https://name:secret@artist.example" })
      .success,
    false,
  );
});
