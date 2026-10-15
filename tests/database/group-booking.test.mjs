/**
 * Synthetic group/private inventory tests against isolated PostgreSQL.
 * PGlite uses a single backend: the last-seat assertions below verify serialized
 * requests, not a claim that a real multi-connection race has been exercised.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import {
  createTestDatabase,
  asRole,
  acceptFixtureLegal,
  adultParticipant,
  fixtureSafetySubmission,
} from "./helpers.mjs";

let db;
let sequence = 0;
const ids = Object.fromEntries(
  ["host", "otherHost", "admin", "stranger"].map((name) => [name, randomUUID()]),
);
const as = (who, fn) => asRole(db, "authenticated", ids[who] ?? who, fn);
const scalar = async (name, args = []) =>
  (
    await db.query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      args,
    )
  ).rows[0].result;
const rejects = (fn, code) => assert.rejects(fn, (error) => error.code === code);

async function user({ id = randomUUID(), host = false } = {}) {
  await db.query("insert into auth.users(id,email_confirmed_at) values($1,now())", [id]);
  await as(id, () => scalar("attest_adult_account", [true, "adult_account_v1"]));
  await acceptFixtureLegal(db, id, { host });
  if (host) {
    await as(id, () => scalar("enable_host_mode"));
    await as(id, () =>
      scalar("save_host_profile", [
        "Synthetic group host",
        "Synthetic activity portfolio.",
        "Miami",
        null,
      ]),
    );
  }
  return id;
}

before(async () => {
  db = await createTestDatabase();
  for (const [name, id] of Object.entries(ids))
    await user({ id, host: ["host", "otherHost"].includes(name) });
  await db.query(
    "insert into private.admin_memberships(user_id,reason) values($1,'Synthetic group review operator')",
    [ids.admin],
  );
  await as("admin", () => scalar("admin_set_booking_policy", [1440, 1440, true]));
});
after(async () => db?.close());

const options = (
  id,
  { format = "both", capacity = 4, basis = "group", sharedPrice = 2500, resources = [] } = {},
) =>
  as("host", () =>
    scalar("save_listing_booking_options", [id, format, capacity, basis, sharedPrice, resources]),
  );

async function review(id, revision) {
  await as("host", () => scalar("submit_listing_for_review", [id]));
  await as("admin", () =>
    scalar("admin_review_listing_safety", [
      id,
      revision,
      "approved",
      "Synthetic group activity evidence reviewed.",
      "2100-01-01T00:00:00Z",
      false,
    ]),
  );
  for (const action of ["approve_safety", "waive_consultation", "publish"]) {
    const version = (
      await db.query("select updated_at::text as v from public.listings where id=$1", [id])
    ).rows[0].v;
    await as("admin", () =>
      scalar("admin_review_listing", [
        id,
        action,
        version,
        "Synthetic group review.",
        "",
        null,
        "Recorded group-specific synthetic risk assessment.",
        { profile: true, experience: true, location: true, risks: true },
      ]),
    );
  }
}

async function fixture({
  start = new Date(Date.UTC(2099, 5, 1 + sequence++, 14)).toISOString(),
  configure = {},
  price = 12000,
  safety = {},
  publish = true,
} = {}) {
  const id = await as("host", () =>
    scalar("create_listing", [
      "Synthetic group activity",
      "Spend time on a reviewed activity.",
      "art",
      price,
      60,
      "Miami",
      "Wynwood",
    ]),
  );
  if (configure !== null) await options(id, configure);
  await as("host", async () => {
    await scalar("save_listing_location", [
      id,
      "SYNTHETIC PRIVATE VENUE",
      "",
      "33127",
      "Meet the host.",
    ]);
    const path = `${ids.host}/${id}/${randomUUID()}.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values('listing-photos',$1,$2)",
      [path, ids.host],
    );
    await scalar("add_listing_photo", [id, path, "Synthetic activity demonstration", 0]);
    await scalar("add_availability_window", [
      id,
      start,
      new Date(Date.parse(start) + 3 * 3600000).toISOString(),
    ]);
  });
  const revision = await as("host", () =>
    scalar("save_listing_safety_submission", [
      id,
      null,
      fixtureSafetySubmission({
        supervision_plan: "Synthetic fixture: host supervises all participants throughout.",
        ...safety,
      }),
    ]),
  );
  if (publish) await review(id, revision);
  return { id, start, end: new Date(Date.parse(start) + 3600000).toISOString(), revision };
}

const envelope = (f, count = 1, extra = {}) => ({
  members: Array.from({ length: count }, () => ({ kind: "adult", age_at_experience: 30 })),
  adult_booker_confirmed: true,
  rules_accepted: true,
  guardian_authority_confirmed: false,
  guardian_presence_accepted: false,
  rules_revision: f.revision,
  group_authority_confirmed: true,
  ...extra,
});
async function request(
  f,
  { mode = "shared", count = 1, participants = envelope(f, count), guest, start = f.start } = {},
) {
  const actor = guest ?? (await user());
  return as(actor, () =>
    scalar("request_group_booking", [
      f.id,
      start,
      "Synthetic group request",
      participants,
      mode,
      count,
    ]),
  );
}
const booking = async (id) =>
  (await db.query("select * from public.bookings where id=$1", [id])).rows[0];
const slots = (f, mode = "shared", count = 1) =>
  asRole(
    db,
    "anon",
    null,
    async () =>
      (
        await db.query("select * from public.list_group_booking_slots($1,$2,$3,$4,$5)", [
          f.id,
          f.start,
          new Date(Date.parse(f.start) + 86400000).toISOString(),
          mode,
          count,
        ])
      ).rows,
  );
const atStart = (rows, f) =>
  rows.find((row) => new Date(row.starts_at).getTime() === Date.parse(f.start));
const resource = (label, kind = "boat", who = "host") =>
  as(who, () => scalar("save_host_resource", [null, label, kind]));

test("existing listings remain private, one participant and the original flat price", async () => {
  const f = await fixture({ configure: null });
  const row = (
    await db.query(
      "select booking_format,max_guests,private_price_basis from public.listings where id=$1",
      [f.id],
    )
  ).rows[0];
  assert.deepEqual(row, { booking_format: "private", max_guests: 1, private_price_basis: "group" });
  const guest = await user();
  const id = await as(guest, () =>
    scalar("request_booking", [
      f.id,
      f.start,
      "Legacy single participant",
      adultParticipant(f.revision),
    ]),
  );
  const captured = await booking(id);
  assert.equal(captured.booking_mode, "private");
  assert.equal(captured.party_size, 1);
  assert.equal(captured.amount_cents, 12000);
  assert.equal(captured.unit_price_cents_snapshot, 12000);
  assert.equal(captured.price_basis_snapshot, "group");
  await rejects(() => request(f, { mode: "private", count: 2 }), "22023");
});

test("booking options validate bounds, prices, modes and ownership", async () => {
  const f = await fixture({ publish: false });
  for (const invalid of [
    { capacity: 0 },
    { capacity: 51 },
    { format: "public" },
    { basis: "boat" },
    { format: "shared", sharedPrice: null },
    { sharedPrice: -1 },
  ])
    await rejects(() => options(f.id, invalid), "22023");
  await rejects(
    () =>
      as("otherHost", () =>
        scalar("save_listing_booking_options", [f.id, "both", 4, "group", 2500, []]),
      ),
    "42501",
  );
  await rejects(
    () =>
      asRole(db, "anon", null, () =>
        scalar("save_listing_booking_options", [f.id, "both", 4, "group", 2500, []]),
      ),
    "42501",
  );
});

test("atomic listing creation and save roll back every field when resource ownership is invalid", async () => {
  const foreign = await resource("Synthetic foreign atomic resource", "boat", "otherHost");
  const own = await resource("Synthetic owned atomic resource");
  const args = [
    "Atomic group activity",
    "A synthetic group activity.",
    "art",
    12000,
    60,
    "Miami",
    "Wynwood",
    "both",
    4,
    "group",
    2500,
  ];
  const countBefore = (
    await db.query("select count(*)::int as n from public.listings where host_id=$1", [ids.host])
  ).rows[0].n;
  await rejects(
    () => as("host", () => scalar("create_listing_with_booking_options", [...args, [foreign]])),
    "42501",
  );
  assert.equal(
    (await db.query("select count(*)::int as n from public.listings where host_id=$1", [ids.host]))
      .rows[0].n,
    countBefore,
  );
  const id = await as("host", () =>
    scalar("create_listing_with_booking_options", [...args, [own]]),
  );
  const beforeRow = (await db.query("select * from public.listings where id=$1", [id])).rows[0];
  const changed = [...args];
  changed[0] = "Changed title that must roll back";
  changed[3] = 50000;
  changed[8] = 6;
  await rejects(
    () =>
      as("host", () => scalar("save_listing_with_booking_options", [id, ...changed, [foreign]])),
    "42501",
  );
  assert.deepEqual(
    (await db.query("select * from public.listings where id=$1", [id])).rows[0],
    beforeRow,
  );
  assert.deepEqual(await as("host", () => scalar("get_listing_resource_ids", [id])), [own]);
});

test("private group pricing reserves the session once; per-guest and shared pricing multiply on the server", async () => {
  const flat = await fixture({ configure: { format: "private", capacity: 6, sharedPrice: null } });
  const flatQuote = atStart(await slots(flat, "private", 4), flat);
  assert.equal(flatQuote.price_cents, 12000);
  const flatBooking = await booking(await request(flat, { mode: "private", count: 4 }));
  assert.equal(flatBooking.amount_cents, 12000);
  assert.equal(flatBooking.party_size, 4);
  assert.equal(flatBooking.price_basis_snapshot, "group");
  const perGuest = await fixture({ configure: { basis: "per_guest", capacity: 6 } });
  assert.equal(atStart(await slots(perGuest, "private", 3), perGuest).price_cents, 36000);
  const personal = await booking(await request(perGuest, { mode: "private", count: 3 }));
  assert.equal(personal.amount_cents, 36000);
  assert.equal(personal.price_basis_snapshot, "per_guest");
  const shared = await fixture();
  assert.equal(atStart(await slots(shared, "shared", 3), shared).price_cents, 7500);
  const seats = await booking(await request(shared, { count: 3 }));
  assert.equal(seats.amount_cents, 7500);
  assert.equal(seats.unit_price_cents_snapshot, 2500);
  assert.equal(seats.price_basis_snapshot, "per_guest");
});

test("shared parties consume one departure's seats and a serialized final-seat request cannot overfill", async () => {
  const f = await fixture({ configure: { capacity: 4 } });
  await request(f, { count: 2 });
  assert.equal(atStart(await slots(f), f).remaining_seats, 2);
  await request(f);
  assert.equal(atStart(await slots(f), f).remaining_seats, 1);
  await rejects(() => request(f, { count: 2 }), "23P01");
  await request(f);
  await rejects(() => request(f), "23P01");
  assert.equal(
    (
      await db.query("select sum(party_size)::int as n from public.bookings where listing_id=$1", [
        f.id,
      ])
    ).rows[0].n,
    4,
  );
  assert.equal(atStart(await slots(f), f), undefined);
});

test("a private buyout excludes shared seats and a shared reservation excludes buyout", async () => {
  const privateFirst = await fixture();
  await request(privateFirst, { mode: "private", count: 1 });
  await rejects(() => request(privateFirst, { mode: "shared", count: 1 }), "23P01");
  assert.equal(atStart(await slots(privateFirst, "shared"), privateFirst), undefined);
  const sharedFirst = await fixture();
  await request(sharedFirst, { mode: "shared", count: 1 });
  await rejects(() => request(sharedFirst, { mode: "private", count: 1 }), "23P01");
  assert.equal(atStart(await slots(sharedFirst, "private"), sharedFirst), undefined);
  assert.equal(atStart(await slots(sharedFirst, "shared"), sharedFirst).remaining_seats, 3);
});

test("shared reservations can combine only for the exact same departure, not overlapping start times", async () => {
  const f = await fixture();
  const offset = new Date(Date.parse(f.start) + 30 * 60000).toISOString();
  // A historical/imported overlapping window must not weaken the inventory
  // guard. The normal availability RPC already rejects such overlap.
  await db.query(
    "insert into public.availability_windows(listing_id,host_id,starts_at,ends_at) values($1,$2,$3,$4)",
    [f.id, ids.host, offset, new Date(Date.parse(offset) + 3600000).toISOString()],
  );
  await request(f);
  await rejects(() => request(f, { start: offset }), "23P01");
  // The non-overlapping following departure has its own full capacity.
  const following = new Date(Date.parse(f.start) + 3600000).toISOString();
  const id = await request(f, { start: following, count: 4 });
  assert.equal((await booking(id)).party_size, 4);
});

test("a new activity review cannot merge guests into a departure booked under the old review", async () => {
  const f = await fixture();
  const first = await request(f);
  const second = await request(f);
  assert.equal(atStart(await slots(f), f).remaining_seats, 2);

  const revision = await as("host", () =>
    scalar("save_listing_safety_submission", [
      f.id,
      f.revision,
      fixtureSafetySubmission({
        participation_rules: "Revised synthetic activity instructions require fresh review.",
        supervision_plan: "Synthetic fixture: host supervises all participants throughout.",
      }),
    ]),
  );
  assert.equal(revision, f.revision + 1);
  await review(f.id, revision);
  const reviewed = { ...f, revision };
  await rejects(() => request(reviewed), "23P01");
  const available = await slots(reviewed);
  assert.equal(atStart(available, reviewed), undefined);
  const next = { ...reviewed, start: new Date(Date.parse(f.start) + 3600000).toISOString() };
  assert.equal(atStart(available, next).remaining_seats, 4);

  // A status recheck of an old booking compares against its own captured
  // revision and still counts the other old reservation. This is isolated
  // postgres-only inspection, not an exposed browser capability.
  const capturedInventory = async (capacity) =>
    (
      await db.query(
        "select * from private.group_inventory($1,$2,$3,$4,'shared',1,$5,'{}'::uuid[],$6)",
        [f.id, ids.host, f.start, f.end, capacity, first],
      )
    ).rows[0];
  assert.deepEqual(await capturedInventory(4), {
    available: true,
    remaining_seats: 3,
    private_available: false,
  });
  assert.equal((await capturedInventory(5)).available, false);
  const snapshots = (
    await db.query(
      "select rules_snapshot->>'revision' as revision from private.booking_participation where booking_id=any($1::uuid[])",
      [[first, second]],
    )
  ).rows;
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots.every((row) => Number(row.revision) === f.revision));
  assert.equal(
    (await db.query("select private.booking_participation_current($1) as current", [first])).rows[0]
      .current,
    false,
  );
});

test("host calendar blocks prevent both booking modes even when a listing has explicit resources", async () => {
  const boat = await resource("Synthetic manually blocked boat");
  const f = await fixture({ configure: { resources: [boat] } });
  const block = await as("host", () =>
    scalar("add_host_calendar_block", [f.start, f.end, "Synthetic external reservation"]),
  );
  for (const mode of ["private", "shared"]) {
    assert.equal(atStart(await slots(f, mode), f), undefined);
    await rejects(() => request(f, { mode }), "23P01");
  }
  await as("host", () => scalar("remove_host_calendar_block", [block]));
  assert.ok(atStart(await slots(f), f));
  await request(f);
});

test("requested format must be offered and party size must be a positive approved capacity", async () => {
  const privateOnly = await fixture({ configure: { format: "private", sharedPrice: null } });
  await rejects(() => request(privateOnly), "22023");
  const sharedOnly = await fixture({ configure: { format: "shared" } });
  await rejects(() => request(sharedOnly, { mode: "private" }), "22023");
  for (const count of [0, -1, 5])
    await rejects(
      () => request(sharedOnly, { count, participants: envelope(sharedOnly) }),
      "22023",
    );
});

test("resource ownership and private resource details cannot be read or reassigned by another host", async () => {
  const own = await resource("Synthetic boat Alpha");
  const foreign = await resource("Synthetic boat Beta", "boat", "otherHost");
  const f = await fixture({ publish: false, configure: { resources: [own] } });
  assert.deepEqual(await as("host", () => scalar("get_listing_resource_ids", [f.id])), [own]);
  await rejects(() => options(f.id, { resources: [foreign] }), "42501");
  await rejects(
    () => as("otherHost", () => scalar("save_host_resource", [own, "Stolen boat", "boat"])),
    "42501",
  );
  await rejects(() => as("otherHost", () => scalar("get_listing_resource_ids", [f.id])), "42501");
  await rejects(
    () => asRole(db, "anon", null, () => scalar("get_listing_resource_ids", [f.id])),
    "42501",
  );
});

test("the same boat or captain conflicts across listings, while fully disjoint resources allow parallel departures", async () => {
  const boatA = await resource("Synthetic boat A");
  const boatB = await resource("Synthetic boat B");
  const captainA = await resource("Synthetic captain A", "captain");
  const captainB = await resource("Synthetic captain B", "captain");
  const first = await fixture({ configure: { resources: [boatA, captainA] } });
  const sameBoat = await fixture({
    start: first.start,
    configure: { resources: [boatA, captainB] },
  });
  const sameCaptain = await fixture({
    start: first.start,
    configure: { resources: [boatB, captainA] },
  });
  const independent = await fixture({
    start: first.start,
    configure: { resources: [boatB, captainB] },
  });
  await request(first, { count: 1 });
  await rejects(() => request(sameBoat), "23P01");
  await rejects(() => request(sameCaptain), "23P01");
  assert.equal(atStart(await slots(sameBoat), sameBoat), undefined);
  assert.equal(atStart(await slots(sameCaptain), sameCaptain), undefined);
  const other = await booking(await request(independent));
  assert.deepEqual([...other.resource_ids_snapshot].sort(), [boatB, captainB].sort());
});

test("unassigned resource calendars keep conservative host-wide conflicts in either booking order", async () => {
  const boat = await resource("Synthetic default overlap boat");
  for (const explicitFirst of [false, true]) {
    const unassigned = await fixture();
    const assigned = await fixture({ start: unassigned.start, configure: { resources: [boat] } });
    const first = explicitFirst ? assigned : unassigned;
    const second = explicitFirst ? unassigned : assigned;
    await request(first);
    await rejects(() => request(second), "23P01");
  }
});

test("expired requests and explicit unpaid cancellations release seats without deleting snapshot history", async () => {
  const f = await fixture({ configure: { capacity: 2 } });
  const guest = await user();
  const id = await request(f, { count: 2, guest });
  await db.query(
    "update public.bookings set request_expires_at=now()-interval '1 second' where id=$1",
    [id],
  );
  assert.equal(atStart(await slots(f, "shared", 2), f).remaining_seats, 2);
  const replacementGuest = await user();
  const replacement = await request(f, { count: 2, guest: replacementGuest });
  assert.equal((await booking(id)).status, "expired");
  assert.equal((await booking(id)).party_size, 2);
  await as(replacementGuest, () => scalar("cancel_unpaid_booking", [replacement]));
  assert.equal(atStart(await slots(f, "shared", 2), f).remaining_seats, 2);
  assert.equal((await booking(replacement)).status, "cancelled");
});

test("active reservations prevent capacity, resource and pricing options from changing underneath a booking", async () => {
  const boat = await resource("Synthetic protected boat");
  const f = await fixture({ configure: { resources: [boat] } });
  await request(f, { count: 3 });
  for (const change of [
    { capacity: 2, resources: [boat] },
    { capacity: 4, resources: [] },
    { capacity: 4, resources: [boat], basis: "per_guest" },
    { capacity: 4, resources: [boat], sharedPrice: 3000 },
  ])
    await rejects(() => options(f.id, change), "55000");
  const row = (
    await db.query("select max_guests,shared_price_cents from public.listings where id=$1", [f.id])
  ).rows[0];
  assert.deepEqual(row, { max_guests: 4, shared_price_cents: 2500 });
});

test("every participant must match the party count, age bounds and genuine boolean acknowledgments", async () => {
  const f = await fixture({ safety: { min_age: 8, max_age: 70, guardian_presence: "required" } });
  const member = (kind, age_at_experience) => ({ kind, age_at_experience });
  const valid = envelope(f, 2, {
    members: [member("adult", 30), member("minor", 12)],
    guardian_authority_confirmed: true,
    guardian_presence_accepted: true,
  });
  const failures = [
    { ...valid, members: [member("adult", 30)] },
    { ...valid, members: [member("adult", 30), member("minor", 7)] },
    { ...valid, members: [member("adult", 30), member("adult", 71)] },
    { ...valid, members: [member("adult", 17), member("minor", 12)] },
    { ...valid, members: [member("adult", 30), member("minor", 18)] },
    { ...valid, members: [member("adult", "30"), member("minor", 12)] },
    { ...valid, members: [member("adult", 30.5), member("minor", 12)] },
    {
      ...valid,
      members: [
        { ...member("adult", 30), full_name: "Unnecessary child identity" },
        member("minor", 12),
      ],
    },
    { ...valid, guardian_authority_confirmed: false },
    { ...valid, guardian_presence_accepted: false },
    { ...valid, adult_booker_confirmed: false },
    { ...valid, rules_accepted: "true" },
    { ...valid, group_authority_confirmed: false },
  ];
  for (const participants of failures)
    await rejects(() => request(f, { count: 2, participants }), "22023");
  await rejects(
    () => request(f, { count: 2, participants: { ...valid, rules_revision: f.revision + 1 } }),
    "40001",
  );
  assert.equal(
    (await db.query("select count(*)::int as n from public.bookings where listing_id=$1", [f.id]))
      .rows[0].n,
    0,
  );
  const guest = await user();
  const id = await request(f, { count: 2, participants: valid, guest });
  assert.equal((await booking(id)).party_size, 2);
  const saved = await as(guest, () => scalar("get_booking_party_participation", [id]));
  assert.deepEqual(saved.members, valid.members);
  assert.equal(saved.group_authority_confirmed, true);
  assert.ok(saved.accepted_at);
});

test("a required accompanying guardian has a counted, priced seat even for a child-only activity", async () => {
  const f = await fixture({
    configure: { capacity: 2 },
    safety: { min_age: 8, max_age: 17, guardian_presence: "required" },
  });
  const acknowledgments = { guardian_authority_confirmed: true, guardian_presence_accepted: true };
  await rejects(
    () =>
      request(f, {
        participants: envelope(f, 1, {
          ...acknowledgments,
          members: [{ kind: "minor", age_at_experience: 12 }],
        }),
      }),
    "22023",
  );
  for (const members of [
    [
      { kind: "guardian", age_at_experience: 17 },
      { kind: "minor", age_at_experience: 12 },
    ],
    [
      { kind: "guardian", age_at_experience: 121 },
      { kind: "minor", age_at_experience: 12 },
    ],
    [
      { kind: "adult", age_at_experience: 30 },
      { kind: "minor", age_at_experience: 12 },
    ],
    [
      { kind: "guardian", age_at_experience: 30 },
      { kind: "guardian", age_at_experience: 40 },
    ],
  ])
    await rejects(
      () => request(f, { count: 2, participants: envelope(f, 2, { ...acknowledgments, members }) }),
      "22023",
    );
  const guest = await user();
  // Guardian is intentionally first: the legacy lead snapshot must select the
  // participating child instead of rejecting the adult against child age bounds.
  const members = [
    { kind: "guardian", age_at_experience: 30 },
    { kind: "minor", age_at_experience: 12 },
  ];
  const id = await request(f, {
    count: 2,
    guest,
    participants: envelope(f, 2, { ...acknowledgments, members }),
  });
  assert.equal((await booking(id)).amount_cents, 5000);
  assert.equal((await booking(id)).party_size, 2);
  assert.deepEqual(
    (await as(guest, () => scalar("get_booking_party_participation", [id]))).members,
    members,
  );
  assert.equal((await as(guest, () => scalar("get_booking_participation", [id]))).kind, "minor");
  assert.equal(atStart(await slots(f), f), undefined);
});

test("a singleton can decline group authority without recording a false assertion; the field remains strictly boolean", async () => {
  const f = await fixture();
  const guest = await user();
  const participants = envelope(f);
  const missing = { ...participants };
  delete missing.group_authority_confirmed;
  await rejects(() => request(f, { guest, participants: missing }), "22023");
  await rejects(
    () =>
      request(f, { guest, participants: { ...participants, group_authority_confirmed: "true" } }),
    "22023",
  );
  participants.group_authority_confirmed = false;
  const id = await request(f, { guest, participants });
  assert.equal(
    (await as(guest, () => scalar("get_booking_party_participation", [id])))
      .group_authority_confirmed,
    false,
  );
});

test("group price, mode, quantity and resource snapshots are immutable and foreign booking reads are denied", async () => {
  const boat = await resource("Synthetic immutable boat");
  const f = await fixture({ configure: { resources: [boat] } });
  const guest = await user();
  const id = await request(f, { count: 2, guest });
  for (const assignment of [
    "party_size=3",
    "booking_mode='private'",
    "price_basis_snapshot='group'",
    "unit_price_cents_snapshot=1",
    "resource_ids_snapshot='{}'::uuid[]",
    "amount_cents=1",
  ])
    await rejects(
      () => db.query(`update public.bookings set ${assignment} where id=$1`, [id]),
      "55000",
    );
  for (const who of [guest, "host", "admin"]) {
    assert.ok(await as(who, () => scalar("get_booking_participation", [id])));
    const party = await as(who, () => scalar("get_booking_party_participation", [id]));
    assert.deepEqual(party.members, envelope(f, 2).members);
    assert.equal(party.group_authority_confirmed, true);
    assert.ok(party.accepted_at);
  }
  await rejects(() => as("stranger", () => scalar("get_booking_participation", [id])), "42501");
  await rejects(
    () => as("stranger", () => scalar("get_booking_party_participation", [id])),
    "42501",
  );
  await rejects(
    () => asRole(db, "anon", null, () => scalar("get_booking_party_participation", [id])),
    "42501",
  );
  await rejects(
    () =>
      db.query(
        "update private.booking_party_participation set group_authority_confirmed=false where booking_id=$1",
        [id],
      ),
    "55000",
  );
  await rejects(
    () => db.query("delete from private.booking_party_participation where booking_id=$1", [id]),
    "55000",
  );
  await rejects(
    () =>
      as("stranger", () =>
        db.query("select * from private.booking_party_participation where booking_id=$1", [id]),
      ),
    "42501",
  );
  const inaccessible = await as("stranger", () =>
    db.query("select * from public.bookings where id=$1", [id]),
  );
  assert.equal(inaccessible.rows.length, 0);
  assert.equal((await booking(id)).amount_cents, 5000);
});
