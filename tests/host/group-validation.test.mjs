import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listingSchema,
  hostResourceSchema,
  MAX_LISTING_GUESTS,
} from "../../lib/host/validation.ts";

const draft = {
  title: "An afternoon on the bay",
  description: "A private charter or a shared sailing session.",
  category: "sailing",
  price: "900.25",
  durationMinutes: "180",
  city: "Miami",
  neighborhood: "Coconut Grove",
};
const boat = "11111111-1111-4111-8111-111111111111";
const captain = "22222222-2222-4222-8222-222222222222";

test("existing one-guest private drafts keep their price and default booking options", () => {
  const parsed = listingSchema.parse(draft);
  assert.equal(parsed.price, 90025);
  assert.equal(parsed.bookingFormat, "private");
  assert.equal(parsed.maxGuests, 1);
  assert.equal(parsed.privatePriceBasis, "group");
  assert.equal(parsed.sharedPrice, null);
  assert.deepEqual(parsed.resourceIds, []);
});

test("private groups accept either a flat group total or per-guest pricing", () => {
  for (const privatePriceBasis of ["group", "per_guest"]) {
    const parsed = listingSchema.parse({
      ...draft,
      bookingFormat: "private",
      maxGuests: "8",
      privatePriceBasis,
    });
    assert.equal(parsed.price, 90025);
    assert.equal(parsed.maxGuests, 8);
    assert.equal(parsed.privatePriceBasis, privatePriceBasis);
    assert.equal(parsed.sharedPrice, null);
  }
  assert.equal(listingSchema.safeParse({ ...draft, privatePriceBasis: "per_hour" }).success, false);
});

test("shared-only drafts require a seat price and normalize the compatibility price", () => {
  const parsed = listingSchema.parse({
    ...draft,
    price: undefined,
    bookingFormat: "shared",
    sharedPrice: "39.95",
    maxGuests: 12,
  });
  assert.equal(parsed.price, 3995);
  assert.equal(parsed.sharedPrice, 3995);
  assert.equal(parsed.privatePriceBasis, "group");
  assert.equal(listingSchema.safeParse({ ...draft, bookingFormat: "shared" }).success, false);
  for (const sharedPrice of ["0", "-5", "30.001", "1e3", "$40", "100001"]) {
    assert.equal(
      listingSchema.safeParse({ ...draft, bookingFormat: "shared", sharedPrice }).success,
      false,
    );
  }
});

test("both formats require independent valid prices and retain their distinct amounts", () => {
  const parsed = listingSchema.parse({
    ...draft,
    bookingFormat: "both",
    sharedPrice: "80",
    maxGuests: "6",
    resourceIds: [boat, captain],
  });
  assert.equal(parsed.price, 90025);
  assert.equal(parsed.sharedPrice, 8000);
  assert.deepEqual(parsed.resourceIds, [boat, captain]);
  assert.equal(
    listingSchema.safeParse({ ...draft, bookingFormat: "both", sharedPrice: "80", price: "" })
      .success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({ ...draft, bookingFormat: "both", sharedPrice: "" }).success,
    false,
  );
  assert.equal(listingSchema.safeParse({ ...draft, bookingFormat: "instant" }).success, false);
});

test("capacity is an integer within the supported range, not a per-order override", () => {
  assert.equal(listingSchema.parse({ ...draft, maxGuests: MAX_LISTING_GUESTS }).maxGuests, 50);
  for (const maxGuests of ["", "0", "-1", "1.5", "51", "Infinity", "six"]) {
    assert.equal(listingSchema.safeParse({ ...draft, maxGuests }).success, false, maxGuests);
  }
});

test("resources must be unique valid IDs and resource creation requires a recognized type", () => {
  assert.equal(listingSchema.safeParse({ ...draft, resourceIds: [boat, boat] }).success, false);
  assert.equal(
    listingSchema.safeParse({ ...draft, resourceIds: ["other-host-boat"] }).success,
    false,
  );
  const resources = Array.from(
    { length: 11 },
    (_, index) => `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
  );
  assert.equal(
    listingSchema.safeParse({ ...draft, resourceIds: resources.slice(0, 10) }).success,
    true,
  );
  assert.equal(listingSchema.safeParse({ ...draft, resourceIds: resources }).success, false);
  assert.deepEqual(hostResourceSchema.parse({ label: "  Sea Breeze  ", kind: "boat" }), {
    label: "Sea Breeze",
    kind: "boat",
  });
  assert.equal(hostResourceSchema.safeParse({ label: " ", kind: "boat" }).success, false);
  assert.equal(hostResourceSchema.safeParse({ label: "Alex", kind: "admin" }).success, false);
  assert.equal(
    hostResourceSchema.safeParse({ resourceId: "wrong", label: "Alex", kind: "captain" }).success,
    false,
  );
});

test("unused prices cannot leak into or prevent the selected booking format", () => {
  const shared = listingSchema.parse({
    ...draft,
    bookingFormat: "shared",
    sharedPrice: "30",
    price: "stale private price",
    privatePriceBasis: "obsolete",
  });
  assert.equal(shared.price, 3000);
  assert.equal(shared.sharedPrice, 3000);
  assert.equal(shared.privatePriceBasis, "group");
  const privateOnly = listingSchema.parse({
    ...draft,
    bookingFormat: "private",
    sharedPrice: "stale shared price",
  });
  assert.equal(privateOnly.price, 90025);
  assert.equal(privateOnly.sharedPrice, null);
});
