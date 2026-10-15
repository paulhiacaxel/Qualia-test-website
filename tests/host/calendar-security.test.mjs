/** Real isolated PostgreSQL policies/commands. PGlite has one backend: lock
 * acquisition and both serial orderings are checked; two-connection load is a
 * separate deployed integration check, not something this suite pretends to do. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, beforeEach, afterEach, test } from "node:test";
import {
  asRole,
  createTestDatabase,
  attestFixtureAdult,
  acceptFixtureLegal,
  approveFixtureSafety,
  adultParticipant,
} from "../database/helpers.mjs";

let db;
const host = randomUUID(),
  host2 = randomUUID(),
  guest = randomUUID(),
  admin = randomUUID(),
  unverified = randomUUID();
const start = "2099-06-01T14:00:00Z",
  end = "2099-06-01T15:00:00Z";
let listing, secondListing;
before(async () => {
  db = await createTestDatabase();
  for (const id of [host, host2, guest, admin, unverified])
    await db.query("insert into auth.users(id,email_confirmed_at) values($1,$2)", [
      id,
      id === unverified ? null : new Date(),
    ]);
  for (const id of [host, host2, guest, admin]) {
    await attestFixtureAdult(db, id);
    await acceptFixtureLegal(db, id, { host: [host, host2].includes(id) });
  }
  await db.query("update public.profiles set is_host=true where id=any($1)", [
    [host, host2, unverified],
  ]);
  for (const id of [host, host2])
    await db.query(
      "insert into public.host_profiles(user_id,display_name,city) values($1,'Calendar test host','Miami')",
      [id],
    );
  await db.query(
    "insert into private.admin_memberships(user_id,reason) values($1,'Synthetic test operator')",
    [admin],
  );
});
after(async () => db.close());
beforeEach(async () => {
  await db.exec("begin");
  await rpc(admin, "admin_set_booking_policy", [1440, 1440, true]);
  listing = await fixture(host);
  secondListing = await fixture(host);
});
afterEach(async () => db.exec("rollback"));

async function rpc(actor, name, args = [], role = "authenticated") {
  return asRole(db, role, actor, async () => {
    await db.exec("savepoint command_test");
    try {
      const result = await db.query(
        `select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) as value`,
        args,
      );
      await db.exec("release savepoint command_test");
      return result.rows[0]?.value;
    } catch (error) {
      await db.exec("rollback to savepoint command_test; release savepoint command_test");
      throw error;
    }
  });
}
const rejects = (fn, code) => assert.rejects(fn, (error) => error.code === code);
async function fixture(owner) {
  const id = randomUUID();
  await db.query(
    `insert into public.listings(id,host_id,title,category,price_cents,duration_minutes,city,status,safety_status,consultation_status,published_at)
    values($1,$2,'Synthetic calendar lesson','art',10000,60,'Miami','draft','pending','not_requested',null)`,
    [id, owner],
  );
  await db.query(
    "insert into private.listing_locations(listing_id,address_line1,postal_code) values($1,'Synthetic private location','33127')",
    [id],
  );
  await db.query(
    "insert into public.availability_windows(listing_id,host_id,starts_at,ends_at) values($1,$2,$3,$4)",
    [id, owner, start, "2099-06-01T18:00:00Z"],
  );
  await approveFixtureSafety(db, { listingId: id, hostId: owner, adminId: admin });
  return id;
}
const block = (from = start, until = end) =>
  rpc(host, "add_host_calendar_block", [from, until, "External appointment"]);
const request = (id = listing, at = start) =>
  rpc(guest, "request_booking", [id, at, "", adultParticipant()]);
const slots = (id = listing) =>
  db.query("select * from public.list_booking_slots($1,$2,$3)", [
    id,
    start,
    "2099-06-02T00:00:00Z",
  ]);
const booking = async (id) =>
  (await db.query("select * from public.bookings where id=$1", [id])).rows[0];

test("host blocks hide slots across every owned listing, preserve adjacent times and other hosts", async () => {
  const otherListing = await fixture(host2);
  await block();
  for (const id of [listing, secondListing]) {
    assert.equal((await slots(id)).rows.length, 3);
    await rejects(() => request(id), "23P01");
  }
  assert.equal((await slots(otherListing)).rows.length, 4);
  assert.equal((await slots()).rows[0].starts_at.toISOString(), "2099-06-01T15:00:00.000Z");
  assert.ok(await request(listing, end));
});

test("request-first blocks are rejected without cancelling any stage of an active booking", async () => {
  const id = await request();
  for (const status of ["requested", "awaiting_payment", "confirmed"]) {
    if (status === "awaiting_payment") await rpc(host, "respond_booking", [id, "accept"]);
    if (status === "confirmed")
      await db.query("update public.bookings set status='confirmed' where id=$1", [id]);
    await rejects(() => block(), "QL002");
    assert.equal((await booking(id)).status, status);
    assert.equal(
      (await db.query("select count(*)::int n from public.host_calendar_blocks")).rows[0].n,
      0,
    );
  }
});

test("manual block commands hold the same transaction-level host lock as booking admission", async () => {
  await block();
  const locks = await db.query(
    "select granted,mode from pg_locks where locktype='advisory' and classid=72461 and objid=hashtext($1)::oid",
    [host],
  );
  assert.ok(locks.rows.some((row) => row.granted && row.mode === "ExclusiveLock"));
  await rejects(() => request(secondListing), "23P01");
});

test("busy notes and imports are private; unverified/nonhosts cannot create blocks and owners cannot raw-write", async () => {
  const id = await block();
  for (const actor of [host2, guest, admin]) {
    const result = await asRole(db, "authenticated", actor, () =>
      db.query("select * from public.host_calendar_blocks"),
    );
    assert.equal(result.rows.length, 0);
    await rejects(() => rpc(actor, "remove_host_calendar_block", [id]), "42501");
  }
  for (const actor of [guest, unverified])
    await rejects(() => rpc(actor, "add_host_calendar_block", [start, end, ""]), "42501");
  await rejects(() => rpc(null, "add_host_calendar_block", [start, end, ""], "anon"), "42501");
  await asRole(db, "authenticated", host, async () => {
    assert.equal((await db.query("select id from public.host_calendar_blocks")).rows.length, 1);
    await db.exec("savepoint denied_write");
    await rejects(
      () => db.query("update public.host_calendar_blocks set host_id=$1", [host2]),
      "42501",
    );
    await db.exec("rollback to savepoint denied_write; release savepoint denied_write");
  });
  await rpc(host, "remove_host_calendar_block", [id]);
  assert.equal((await slots()).rows.length, 4);
});

test("expired requests permit a block, but stale acceptance cannot revive the booking", async () => {
  const id = await request();
  await db.query(
    "update public.bookings set request_expires_at=now()-interval '1 minute' where id=$1",
    [id],
  );
  await block();
  await rejects(() => rpc(host, "respond_booking", [id, "accept"]), "55000");
  assert.equal((await booking(id)).status, "requested"); // rejected RPC rolls expiry back too
  await rejects(() => request(secondListing), "23P01");
});

test("weekly availability batches are atomic on a later conflict and guarded against foreign ownership", async () => {
  const windows = [
    { starts_at: "2099-06-02T14:00:00Z", ends_at: "2099-06-02T16:00:00Z" },
    { starts_at: start, ends_at: end },
  ];
  await rejects(() => rpc(host, "add_availability_windows", [listing, windows]), "23P01");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.availability_windows where listing_id=$1",
        [listing],
      )
    ).rows[0].n,
    1,
  );
  await rejects(() => rpc(host2, "add_availability_windows", [listing, [windows[0]]]), "42501");
  assert.equal(await rpc(host, "add_availability_windows", [listing, [windows[0]]]), 1);
});

test("editing availability retains the original on invalid change and rejects booked windows", async () => {
  const original = (
    await db.query("select * from public.availability_windows where listing_id=$1", [listing])
  ).rows[0];
  await rejects(() => rpc(host, "edit_availability_window", [original.id, end, start]), "22023");
  assert.equal(
    (
      await db.query("select starts_at from public.availability_windows where id=$1", [original.id])
    ).rows[0].starts_at.toISOString(),
    "2099-06-01T14:00:00.000Z",
  );
  await request();
  await rejects(
    () =>
      rpc(host, "edit_availability_window", [
        original.id,
        "2099-06-02T14:00:00Z",
        "2099-06-02T17:00:00Z",
      ]),
    "55000",
  );
});

test("calendar replacement is atomic and cannot mutate another host's import", async () => {
  const bounds = (
    await db.query(
      "select now() a, now()+interval '366 days' z, now()+interval '20 days' s, now()+interval '20 days 1 hour' e",
    )
  ).rows[0];
  const data = [{ starts_at: bounds.s.toISOString(), ends_at: bounds.e.toISOString() }];
  const id = await rpc(host, "save_host_calendar_import", [
    null,
    "External calendar",
    bounds.a,
    bounds.z,
    data,
  ]);
  await rejects(
    () => rpc(host2, "save_host_calendar_import", [id, "Hijack", bounds.a, bounds.z, []]),
    "42501",
  );
  await rejects(
    () =>
      rpc(host, "save_host_calendar_import", [
        id,
        "Invalid replacement",
        bounds.a,
        bounds.z,
        [{ starts_at: bounds.z, ends_at: bounds.a }],
      ]),
    "22023",
  );
  assert.equal(
    (await db.query("select label from public.host_calendar_imports where id=$1", [id])).rows[0]
      .label,
    "External calendar",
  );
  const blockId = (
    await db.query("select id from public.host_calendar_blocks where import_id=$1", [id])
  ).rows[0].id;
  const held = (
    await db.query("select now()+interval '21 days' s, now()+interval '21 days 1 hour' e")
  ).rows[0];
  await rpc(host, "add_availability_window", [listing, held.s, held.e]);
  const requestId = await request(listing, held.s.toISOString());
  await rejects(
    () =>
      rpc(host, "save_host_calendar_import", [
        id,
        "Conflicting refresh",
        bounds.a,
        bounds.z,
        [...data, { starts_at: held.s.toISOString(), ends_at: held.e.toISOString() }],
      ]),
    "QL002",
  );
  assert.equal((await booking(requestId)).status, "requested");
  assert.equal(
    (await db.query("select id from public.host_calendar_blocks where import_id=$1", [id])).rows[0]
      .id,
    blockId,
  );
  assert.equal(
    (await db.query("select label from public.host_calendar_imports where id=$1", [id])).rows[0]
      .label,
    "External calendar",
  );
  await rejects(() => rpc(host, "remove_host_calendar_block", [blockId]), "42501");
  await rpc(host, "save_host_calendar_import", [id, "Refreshed calendar", bounds.a, bounds.z, []]);
  assert.equal(
    (
      await db.query("select count(*)::int n from public.host_calendar_blocks where import_id=$1", [
        id,
      ])
    ).rows[0].n,
    0,
  );
  await rpc(host, "remove_host_calendar_import", [id]);
  assert.equal(
    (await db.query("select count(*)::int n from public.host_calendar_imports")).rows[0].n,
    0,
  );
});

test("a late paid checkout against an expired hold is quarantined when an external block now exists", async () => {
  const id = await request();
  await rpc(host, "respond_booking", [id, "accept"]);
  const policy = randomUUID(),
    attempt = randomUUID(),
    event = randomUUID();
  await db.query(
    `insert into private.commercial_policies(id,environment,standard_fee_bps,founder_fee_bps,processing_allocation,payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,terms_version,cancellation_terms,approved_by)
    values($1,'sandbox',1750,1250,'host_actual_cost',48,true,1,2,'test-only','Synthetic terms',$2)`,
    [policy, admin],
  );
  await db.query(
    `insert into private.payment_attempts(id,booking_id,environment,guest_id,host_id,account_id,amount_cents,currency,commission_bps,commission_cents,policy_id,state,session_id,expires_at,terms_accepted_at)
    values($1,$2,'sandbox',$3,$4,'acct_fixture',10000,'usd',1750,1750,$5,'expired','cs_test_fixture',now()-interval '1 hour',now()-interval '2 hours')`,
    [attempt, id, guest, host, policy],
  );
  await db.query(
    "update public.bookings set payment_deadline_at=now()-interval '1 hour' where id=$1",
    [id],
  );
  await block();
  await db.query(
    "insert into private.stripe_event_inbox(id,environment,account_context,event_id,event_type,object_id) values($1,'sandbox','platform','evt_fixture','checkout.session.completed','cs_test_fixture')",
    [event],
  );
  const result = await rpc(
    null,
    "pay_apply_payment",
    [event, attempt, "cs_test_fixture", "pi_fixture", "ch_fixture", 10000, "usd", "paid", 320],
    "service_role",
  );
  assert.equal(result.state, "quarantined");
  assert.equal((await booking(id)).status, "awaiting_payment");
  assert.match(
    (
      await db.query("select quarantine_reason from private.payment_attempts where id=$1", [
        attempt,
      ])
    ).rows[0].quarantine_reason,
    /blocked this time/,
  );
});
