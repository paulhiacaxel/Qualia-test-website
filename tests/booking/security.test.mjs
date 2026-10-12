/** Phase 4 exercises real PostgreSQL RPCs, RLS, snapshots and transaction locks.
 * PGlite has one backend; a real two-connection race test remains a hosted gate.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  createTestDatabase,
  asRole,
  attestFixtureAdult,
  approveFixtureSafety,
  adultParticipant,
} from "../database/helpers.mjs";

let db;
const user = Object.fromEntries(
  ["host", "host2", "guest", "guest2", "stranger", "admin", "unverified"].map((name) => [
    name,
    randomUUID(),
  ]),
);
const denied = (fn) => assert.rejects(fn, (error) => error.code === "42501");
const rejected = (fn, code = "55000") => assert.rejects(fn, (error) => error.code === code);
const as = (who, fn) => asRole(db, "authenticated", user[who] ?? who, fn);
const rpc = (name, args = []) =>
  db.query(`select * from public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`, args);
const value = async (name, args = []) => (await rpc(name, args)).rows[0][name];
let fixtureNumber = 0;

before(async () => {
  db = await createTestDatabase();
  for (const [name, id] of Object.entries(user)) {
    await db.query(
      "insert into auth.users(id, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3)",
      [id, { full_name: name }, name === "unverified" ? null : new Date()],
    );
  }
  await db.query(
    "insert into private.admin_memberships(user_id, reason) values ($1, 'Test-only operator grant')",
    [user.admin],
  );
  for (const who of ["host", "host2", "guest", "guest2", "stranger", "admin"])
    await attestFixtureAdult(db, user[who]);
  for (const who of ["host", "host2"]) {
    await as(who, async () => {
      await rpc("enable_host_mode");
      await rpc("save_host_profile", [`Test ${who}`, "Private Miami instruction.", "Miami", null]);
    });
  }
});
after(async () => db.close());

async function listingFixture({ host = user.host, day, status = "published", duration = 60 } = {}) {
  const index = ++fixtureNumber;
  const date = day ?? `2099-06-${String(index).padStart(2, "0")}`;
  const id = randomUUID();
  const windowId = randomUUID();
  const path = `${host}/${id}/${randomUUID()}.webp`;
  await db.query(
    `insert into public.listings(id,host_id,title,description,category,price_cents,duration_minutes,city,neighborhood,
    status,safety_status,consultation_status,published_at) values ($1,$2,'A private lesson','Learn with a Miami host.','cooking',15000,$3,'Miami','Wynwood','draft','pending','not_requested',null)`,
    [id, host, duration],
  );
  await db.query(
    "insert into private.listing_locations(listing_id,address_line1,postal_code,meeting_instructions) values ($1,'ORIGINAL PRIVATE ADDRESS','33127','Original meeting directions.')",
    [id],
  );
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id) values ('listing-photos',$1,$2)",
    [path, host],
  );
  await db.query(
    "insert into public.listing_photos(listing_id,storage_path,alt_text) values ($1,$2,'Lesson image')",
    [id, path],
  );
  await db.query(
    "insert into public.availability_windows(id,listing_id,host_id,starts_at,ends_at) values ($1,$2,$3,$4,$5)",
    [windowId, id, host, `${date}T10:00:00Z`, `${date}T14:00:00Z`],
  );
  if (status === "published")
    await approveFixtureSafety(db, { listingId: id, hostId: host, adminId: user.admin });
  return { id, host, date, path, windowId, start: `${date}T10:00:00Z` };
}
const request = (listing, who = "guest", start = listing.start) =>
  as(who, () =>
    value("request_booking", [
      listing.id,
      start,
      "Looking forward to learning.",
      adultParticipant(),
    ]),
  );

test("booking remains closed without an owner-approved policy, and only verified admins can enable it", async () => {
  const listing = await listingFixture();
  const policy = await asRole(db, "anon", null, () => value("get_booking_policy"));
  assert.deepEqual(policy, {
    enabled: false,
    request_expiry_minutes: null,
    payment_deadline_minutes: null,
  });
  await rejected(() => request(listing));
  await as("guest", () => denied(() => rpc("admin_set_booking_policy", [120, 60, true])));
  await as("admin", async () => {
    await rejected(() => rpc("admin_set_booking_policy", [null, null, true]), "22023");
    await rejected(() => rpc("admin_set_booking_policy", [0, 10081, true]), "22023");
    await rpc("admin_set_booking_policy", [null, null, false]);
    await rpc("admin_set_booking_policy", [120, 60, true]);
  });
  assert.deepEqual(await as("guest", () => value("get_booking_policy")), {
    enabled: true,
    request_expiry_minutes: 120,
    payment_deadline_minutes: 60,
  });
  assert.equal(
    (await db.query("select count(*)::int as count from private.booking_policy_history")).rows[0]
      .count,
    2,
  );
});

test("public clients can access only registered photos of published listings", async () => {
  const published = await listingFixture();
  const draft = await listingFixture({ status: "draft" });
  const orphan = `${published.host}/${published.id}/${randomUUID()}.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id) values ('listing-photos',$1,$2)",
    [orphan, published.host],
  );
  await asRole(db, "anon", null, async () => {
    const visible = await db.query("select name from storage.objects where name = any($1)", [
      [published.path, draft.path, orphan],
    ]);
    assert.deepEqual(visible.rows, [{ name: published.path }]);
    const update = await db.query(
      "update storage.objects set metadata = null where name = $1 returning name",
      [published.path],
    );
    assert.deepEqual(update.rows, []);
  });
  await db.query("update public.listings set status='paused', published_at=null where id=$1", [
    published.id,
  ]);
  await asRole(db, "anon", null, async () => {
    assert.deepEqual(
      (await db.query("select name from storage.objects where name = $1", [published.path])).rows,
      [],
    );
  });
});

test("calendar times exclude host-wide requests across listings while preserving other hosts", async () => {
  const first = await listingFixture();
  const sameHost = await listingFixture({ day: first.date });
  const otherHost = await listingFixture({ day: first.date, host: user.host2 });
  const slotArgs = (l) => [l.id, `${l.date}T00:00:00Z`, `${l.date}T23:59:59Z`];
  const beforeSlots = await asRole(db, "anon", null, () =>
    rpc("list_booking_slots", slotArgs(first)),
  );
  assert.equal(beforeSlots.rows.length, 4);
  assert.ok(
    beforeSlots.rows.every(
      (slot) => Object.keys(slot).sort().join(",") === "currency,ends_at,price_cents,starts_at",
    ),
  );
  await request(first);
  await rejected(() => request(sameHost, "guest2"), "23P01");
  const afterSlots = await asRole(db, "anon", null, () =>
    rpc("list_booking_slots", slotArgs(sameHost)),
  );
  assert.equal(afterSlots.rows.length, 3);
  await request(otherHost, "guest2");
  await rejected(() => request(first, "guest2", `${first.date}T10:30:00Z`), "22023");
  await asRole(db, "anon", null, () =>
    rejected(() => rpc("list_booking_slots", [first.id, "2099-01-01", "2099-03-01"]), "22023"),
  );
});

test("request captures server-side price, content, address and policy deadlines; clients cannot forge ownership or confirmation", async () => {
  const listing = await listingFixture();
  await as("unverified", () =>
    denied(() => rpc("request_booking", [listing.id, listing.start, "Hello", adultParticipant()])),
  );
  await as("host", () =>
    rejected(
      () => rpc("request_booking", [listing.id, listing.start, "Self booking", adultParticipant()]),
      "22023",
    ),
  );
  const id = await request(listing);
  await db.query(
    "update public.listings set price_cents=99999,title='Changed later',neighborhood='Elsewhere' where id=$1",
    [listing.id],
  );
  await db.query(
    "update private.listing_locations set address_line1='CHANGED PRIVATE ADDRESS' where listing_id=$1",
    [listing.id],
  );
  const detail = await as("guest", () => value("get_booking_details", [id]));
  assert.equal(detail.booking.amount_cents, 15000);
  assert.equal(detail.listing.title, "A private lesson");
  assert.equal(detail.listing.neighborhood, "Wynwood");
  assert.equal(detail.booking.policy_request_expiry_minutes, 120);
  assert.equal(detail.booking.policy_payment_deadline_minutes, 60);
  assert.equal(detail.meeting_location, null);
  await as("guest", () =>
    denied(() =>
      db.query("update public.bookings set status='confirmed',amount_cents=1 where id=$1", [id]),
    ),
  );
  await as("stranger", () => denied(() => rpc("get_booking_details", [id])));
  await as("admin", () =>
    denied(() => db.query("select * from private.booking_meeting_locations")),
  );
  await db.query("update public.bookings set status='confirmed' where id=$1", [id]); // Simulates trusted future payment backend only.
  const confirmed = await as("guest", () => value("get_booking_details", [id]));
  assert.equal(confirmed.meeting_location.address_line1, "ORIGINAL PRIVATE ADDRESS");
  assert.equal(
    (await as("admin", () => value("get_booking_details", [id]))).meeting_location,
    null,
  );
  await as("guest", () => rejected(() => rpc("cancel_unpaid_booking", [id])));
});

test("only the host accepts or declines; either participant may cancel before payment", async () => {
  const listing = await listingFixture();
  const id = await request(listing);
  await as("guest", () => denied(() => rpc("respond_booking", [id, "accept"])));
  await as("stranger", () => denied(() => rpc("respond_booking", [id, "accept"])));
  await as("host", () => rpc("respond_booking", [id, "accept"]));
  const details = await as("guest", () => value("get_booking_details", [id]));
  assert.equal(details.booking.status, "awaiting_payment");
  assert.ok(new Date(details.booking.payment_deadline_at).getTime() > Date.now());
  assert.equal(details.meeting_location, null);
  await as("guest", () => rpc("cancel_unpaid_booking", [id]));
  assert.equal(
    (await as("guest", () => value("get_booking_details", [id]))).booking.status,
    "cancelled",
  );
  const replacement = await request(listing, "guest2");
  await as("host", () => rpc("respond_booking", [replacement, "decline"]));
  assert.equal(
    (await as("guest2", () => value("get_booking_details", [replacement]))).booking.status,
    "declined",
  );
  await as("guest2", () => rejected(() => rpc("cancel_unpaid_booking", [replacement])));
});

test("expired holds stop blocking slots; a fresh request records expiration and rejects stale host acceptance", async () => {
  const listing = await listingFixture();
  const old = await request(listing);
  await db.query(
    "update public.bookings set request_expires_at=now()-interval '1 minute' where id=$1",
    [old],
  );
  assert.equal(
    (await as("guest", () => value("get_booking_details", [old]))).booking.status,
    "expired",
  );
  await as("host", () => rejected(() => rpc("respond_booking", [old, "accept"])));
  const fresh = await request(listing, "guest2");
  assert.ok(fresh);
  assert.equal(
    (await db.query("select status from public.bookings where id=$1", [old])).rows[0].status,
    "expired",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from private.booking_events where booking_id=$1 and event='expired'",
        [old],
      )
    ).rows[0].count,
    1,
  );
});

test("published availability remains editable but cannot remove any host-wide active reservation window", async () => {
  const listing = await listingFixture();
  const sibling = await listingFixture({ day: listing.date });
  const id = await request(listing, "guest2");
  await as("host", () => rejected(() => rpc("remove_availability_window", [sibling.windowId])));
  const extra = await as("host", () =>
    value("add_availability_window", [
      listing.id,
      `${listing.date}T16:00:00Z`,
      `${listing.date}T18:00:00Z`,
    ]),
  );
  await as("host", () => rpc("remove_availability_window", [extra]));
  await as("guest2", () => rpc("cancel_unpaid_booking", [id]));
  await as("host", () => rpc("remove_availability_window", [sibling.windowId]));
});

test("booking command holds an actual PostgreSQL host advisory lock until the transaction ends", async () => {
  const listing = await listingFixture({ host: user.host2 });
  await db.exec("begin");
  try {
    await request(listing, "stranger");
    const held = await db.query(
      "select granted, mode from pg_locks where locktype='advisory' and classid=72461 and objid=hashtext($1)::oid",
      [user.host2],
    );
    assert.deepEqual(held.rows, [{ granted: true, mode: "ExclusiveLock" }]);
  } finally {
    await db.exec("rollback");
  }
  const released = await db.query(
    "select * from pg_locks where locktype='advisory' and classid=72461 and objid=hashtext($1)::oid",
    [user.host2],
  );
  assert.deepEqual(released.rows, []);
});

test("participant messaging is private and append-only; list-my-bookings joins only owned history", async () => {
  const listing = await listingFixture();
  const id = await request(listing, "stranger");
  await as("stranger", () => rpc("send_booking_message", [id, "Do I need to bring anything?"]));
  await as("host", () => rpc("send_booking_message", [id, "Everything is included."]));
  await as("guest2", () => denied(() => rpc("send_booking_message", [id, "Uninvited"])));
  await as("guest2", async () =>
    assert.deepEqual(
      (await db.query("select id from public.booking_messages where booking_id=$1", [id])).rows,
      [],
    ),
  );
  await as("stranger", async () => {
    const detail = await value("get_booking_details", [id]);
    assert.equal(detail.messages.length, 2);
    assert.equal(detail.messages[0].sender_id, user.stranger);
    await denied(() => db.query("delete from public.booking_messages where booking_id=$1", [id]));
    await denied(() =>
      db.query("update public.booking_messages set sender_id=$1 where booking_id=$2", [
        user.host,
        id,
      ]),
    );
    await denied(() => db.query("delete from public.bookings where id=$1", [id]));
    const mine = (await rpc("list_my_bookings", ["guest"])).rows;
    assert.ok(mine.some((row) => row.id === id && row.listing_title === "A private lesson"));
    assert.ok(mine.every((row) => row.guest_id === user.stranger));
  });
  await db.query("update public.listings set status='paused',published_at=null where id=$1", [
    listing.id,
  ]);
  assert.equal(
    (await as("stranger", () => value("get_booking_details", [id]))).listing.title,
    "A private lesson",
  );
});

test("concierge requests enforce verified identity, ten-per-day limits and admin-only responses", async () => {
  await as("unverified", () =>
    denied(() =>
      rpc("create_support_request", ["Help please", "Could you help me find an experience?"]),
    ),
  );
  await asRole(db, "anon", null, () =>
    denied(() =>
      rpc("create_support_request", ["Help please", "Could you help me find an experience?"]),
    ),
  );
  const id = await as("stranger", () =>
    value("create_support_request", [
      "Find an experience",
      "I would like a private sailing lesson.",
    ]),
  );
  await as("guest", async () => {
    assert.deepEqual(
      (await db.query("select id from public.support_requests where id=$1", [id])).rows,
      [],
    );
    await denied(() => rpc("respond_support_request", [id, "Pretending to be support", true]));
  });
  await as("admin", () =>
    rpc("respond_support_request", [id, "Tell us which dates work for you.", false]),
  );
  await as("stranger", async () => {
    const row = (
      await db.query("select response,status from public.support_requests where id=$1", [id])
    ).rows[0];
    assert.deepEqual(row, { response: "Tell us which dates work for you.", status: "open" });
    await denied(() =>
      db.query("update public.support_requests set response='forged' where id=$1", [id]),
    );
    for (let i = 0; i < 9; i++)
      await rpc("create_support_request", [
        `Question ${i}`,
        "Additional test request for the daily limit.",
      ]);
    await rejected(
      () => rpc("create_support_request", ["One too many", "This request must be rate limited."]),
      "54000",
    );
  });
  await as("admin", () =>
    rpc("respond_support_request", [id, "We have answered your request.", true]),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from private.support_response_history where request_id=$1",
        [id],
      )
    ).rows[0].count,
    2,
  );
});

test("disabling new requests preserves existing accepted deadlines and cancellation access", async () => {
  const listing = await listingFixture({ host: user.host2 });
  const id = await request(listing, "stranger");
  await as("host2", () => rpc("respond_booking", [id, "accept"]));
  const before = (await as("stranger", () => value("get_booking_details", [id]))).booking
    .payment_deadline_at;
  await as("admin", () => rpc("admin_set_booking_policy", [null, null, false]));
  await rejected(() => request(listing, "guest2", `${listing.date}T11:00:00Z`));
  assert.equal(
    (await as("stranger", () => value("get_booking_details", [id]))).booking.payment_deadline_at,
    before,
  );
  await as("stranger", () => rpc("cancel_unpaid_booking", [id]));
});
