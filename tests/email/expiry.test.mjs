import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import {
  asRole,
  createTestDatabase,
  attestFixtureAdult,
  acceptFixtureLegal,
  approveFixtureSafety,
} from "../database/helpers.mjs";

let db;
let fixtureSequence = 0;
const host = randomUUID(),
  guest = randomUUID(),
  admin = randomUUID(),
  listing = randomUUID(),
  policy = randomUUID();
before(async () => {
  db = await createTestDatabase();
  await db.query(
    "insert into auth.users(id,email_confirmed_at) values ($1,now()),($2,now()),($3,now())",
    [host, guest, admin],
  );
  for (const person of [host, guest, admin]) {
    await attestFixtureAdult(db, person);
    await acceptFixtureLegal(db, person, { host: person === host });
  }
  await asRole(db, "authenticated", host, () => db.query("select public.enable_host_mode()"));
  await db.query(
    "insert into private.admin_memberships(user_id,reason) values ($1,'Synthetic email test operator')",
    [admin],
  );
  await db.query(
    "insert into public.host_profiles(user_id,display_name,city) values ($1,'Host','Miami')",
    [host],
  );
  await db.query(
    "insert into public.listings(id,host_id,title,category,price_cents,duration_minutes,city) values ($1,$2,'Private lesson','art',10000,60,'Miami')",
    [listing, host],
  );
  await approveFixtureSafety(db, { listingId: listing, hostId: host, adminId: admin });
  await db.query(
    `insert into private.commercial_policies(id,environment,standard_fee_bps,founder_fee_bps,processing_allocation,payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,terms_version,cancellation_terms,approved_by)
    values($1,'sandbox',1750,1000,'platform_absorbs',48,false,0,0,'fixture','Isolated test policy only',$2)`,
    [policy, host],
  );
});
after(async () => db.close());
beforeEach(async () => {
  fixtureSequence = 0;
  await db.exec("begin");
});
afterEach(async () => db.exec("rollback"));

async function booking(status = "requested", due = true, pastStart = false) {
  const id = randomUUID();
  // Each lifecycle fixture reserves a separate session. The inventory guard
  // must remain active even when testing unrelated deadline/outbox behavior.
  const startHours = pastStart ? -2 - fixtureSequence * 2 : 48 + fixtureSequence * 2;
  fixtureSequence++;
  // These lifecycle fixtures explicitly record adult participation; a writable
  // CTE keeps it atomic inside each test's enclosing rollback transaction.
  await db.query(
    `with fixture as (
    insert into public.bookings(id,listing_id,host_id,guest_id,starts_at,ends_at,amount_cents,status,
      listing_title_snapshot,request_expires_at,payment_deadline_at)
    values ($1,$2,$3,$4,now()+$5*interval '1 hour',now()+($5+1)*interval '1 hour',10000,$6,
      'Private lesson',now()+$7*interval '1 minute',now()+$7*interval '1 minute')
    returning id,listing_id)
    insert into private.booking_participation(booking_id,kind,age_at_experience,rules_snapshot,
    adult_booker_confirmed,rules_accepted,guardian_authority_confirmed,guardian_presence_accepted,account_attestation_version)
    select fixture.id,'self',30,l.participation_rules,true,true,false,false,'adult_account_v1'
    from fixture join public.listings l on l.id=fixture.listing_id`,
    [id, listing, host, guest, startHours, status, due ? -1 : 60],
  );
  return id;
}
async function attempt(id, state) {
  await db.query(
    `insert into private.payment_attempts(booking_id,environment,guest_id,host_id,account_id,amount_cents,currency,
      commission_bps,commission_cents,policy_id,state,expires_at,terms_accepted_at)
    values($1,'sandbox',$2,$3,'acct_fixture',10000,'usd',1750,1750,$4,$5,now()-interval '1 minute',now())`,
    [id, guest, host, policy, state],
  );
}
const sweep = (limit = 100) =>
  asRole(
    db,
    "service_role",
    null,
    async () =>
      (await db.query("select public.expire_due_bookings($1) as count", [limit])).rows[0].count,
  );
const statusOf = async (id) =>
  (await db.query("select status from public.bookings where id=$1", [id])).rows[0].status;

test("service worker persists elapsed deadlines and queues exactly one closure without a page visit", async () => {
  const request = await booking();
  const unpaid = await booking("awaiting_payment");
  const started = await booking("requested", false, true);
  const future = await booking("requested", false);
  const confirmed = await booking("confirmed");
  const cancelled = await booking("cancelled");
  assert.equal(await sweep(), 3);
  assert.equal(await sweep(), 0);
  for (const id of [request, unpaid, started]) {
    assert.equal(await statusOf(id), "expired");
    const outbox = await db.query(
      "select recipient_id from private.email_outbox where booking_id=$1 and kind='request_closed'",
      [id],
    );
    assert.deepEqual(outbox.rows, [{ recipient_id: guest }]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from private.booking_events where booking_id=$1 and event='expired'",
          [id],
        )
      ).rows[0].n,
      1,
    );
  }
  assert.equal(await statusOf(future), "requested");
  assert.equal(await statusOf(confirmed), "confirmed");
  assert.equal(await statusOf(cancelled), "cancelled");
});

test("Stripe holds survive elapsed deadlines until canonical reconciliation removes the hold", async () => {
  const held = [];
  for (const state of ["preparing", "open", "processing", "quarantined"]) {
    const id = await booking("awaiting_payment");
    await attempt(id, state);
    held.push(id);
  }
  assert.equal(await sweep(), 0);
  for (const id of held) assert.equal(await statusOf(id), "awaiting_payment");
  // Simulate the durable result of canonical reconciliation, not a local timeout.
  await db.query("update private.payment_attempts set state='failed' where booking_id=$1", [
    held[0],
  ]);
  assert.equal(await sweep(), 1);
  assert.equal(await statusOf(held[0]), "expired");
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from private.email_outbox where kind='request_closed'",
      )
    ).rows[0].n,
    1,
  );
});

test("batch bound applies to bookings, even when all belong to one host", async () => {
  await booking();
  await booking();
  await booking();
  assert.equal(await sweep(1), 1);
  assert.equal(await sweep(1), 1);
  assert.equal(await sweep(100), 1);
  assert.equal(await sweep(100), 0);
});

test("browser roles cannot invoke either expiry entry point", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (const schema of ["public", "private"]) {
      await db.exec("savepoint permission_test");
      await db.exec(`set role ${role}`);
      await assert.rejects(
        () => db.query(`select ${schema}.expire_due_bookings(1)`),
        (error) => error.code === "42501",
      );
      await db.exec("rollback to savepoint permission_test; reset role");
    }
  }
});

test("invalid batch sizes fail before changing booking state", async () => {
  const id = await booking();
  for (const invalid of [0, -1, 101, null]) {
    await db.exec("savepoint batch_test");
    await db.exec("set role service_role");
    await assert.rejects(
      () => db.query("select public.expire_due_bookings($1)", [invalid]),
      (error) => error.code === "22023",
    );
    await db.exec("rollback to savepoint batch_test; reset role");
  }
  assert.equal(await statusOf(id), "requested");
});

test("transaction rollback removes expiry, audit event and closure notification together", async () => {
  const id = await booking();
  await db.exec("savepoint expiry_test");
  assert.equal(await sweep(), 1);
  await db.exec("rollback to savepoint expiry_test");
  assert.equal(await statusOf(id), "requested");
  assert.equal(
    (
      await db.query("select count(*)::int as n from private.booking_events where booking_id=$1", [
        id,
      ])
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from private.email_outbox where booking_id=$1 and kind='request_closed'",
        [id],
      )
    ).rows[0].n,
    0,
  );
});
