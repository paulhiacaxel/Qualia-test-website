import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import {
  asRole,
  createTestDatabase,
  attestFixtureAdult,
  acceptFixtureLegal,
  approveFixtureSafety,
  adultParticipant,
} from "../database/helpers.mjs";
import { checkoutTermsSchema } from "../../lib/payments/contracts.ts";
import { checkoutWindow } from "../../lib/booking/payment-window.ts";

let db;
const host = randomUUID(),
  guest = randomUUID(),
  admin = randomUUID();
before(async () => {
  db = await createTestDatabase();
  for (const id of [host, guest, admin])
    await db.query("insert into auth.users(id,email_confirmed_at) values ($1,now())", [id]);
  for (const id of [host, guest, admin]) {
    await attestFixtureAdult(db, id);
    await acceptFixtureLegal(db, id, { host: id === host });
  }
  await db.query("update public.profiles set is_host=true where id=$1", [host]);
  await db.query(
    "insert into public.host_profiles(user_id,display_name,city) values ($1,'Host','Miami')",
    [host],
  );
  await db.query(
    "insert into private.admin_memberships(user_id,reason) values ($1,'Isolated test operator')",
    [admin],
  );
});
after(async () => db.close());
beforeEach(async () => {
  await db.exec("begin");
  await rpc(admin, "admin_set_booking_policy", [1440, 1440, true]);
});
afterEach(async () => db.exec("rollback"));

async function rpc(actor, name, args = []) {
  return asRole(db, "authenticated", actor, async () => {
    await db.exec("savepoint rpc_test");
    try {
      const result = await db.query(
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
        args,
      );
      await db.exec("release savepoint rpc_test");
      return result.rows[0]?.value;
    } catch (error) {
      await db.exec("rollback to savepoint rpc_test; release savepoint rpc_test");
      throw error;
    }
  });
}
async function fixture(seconds = 7200) {
  const id = randomUUID();
  const start = (
    await db.query("select now()+$1*interval '1 second' as at", [seconds])
  ).rows[0].at.toISOString();
  await db.query(
    `insert into public.listings(id,host_id,title,category,price_cents,duration_minutes,city,status,safety_status,consultation_status,published_at)
    values($1,$2,'Private lesson','art',10000,1,'Miami','draft','pending','not_requested',null)`,
    [id, host],
  );
  await db.query(
    "insert into private.listing_locations(listing_id,address_line1,postal_code) values($1,'Private fixture address','33127')",
    [id],
  );
  await db.query(
    "insert into public.availability_windows(listing_id,host_id,starts_at,ends_at) values($1,$2,$3,$3::timestamptz+interval '3 minutes')",
    [id, host, start],
  );
  await approveFixtureSafety(db, { listingId: id, hostId: host, adminId: admin });
  return { id, start };
}
const request = (item) =>
  rpc(guest, "request_booking", [item.id, item.start, "", adultParticipant()]);
const row = async (id) =>
  (await db.query("select * from public.bookings where id=$1", [id])).rows[0];

test("SQL policy rejects sub-32 payment windows and does not select a default for the owner", async () => {
  for (const minutes of [1, 30, 31])
    await assert.rejects(
      () => rpc(admin, "admin_set_booking_policy", [1, minutes, true]),
      (error) => error.code === "22023",
    );
  await rpc(admin, "admin_set_booking_policy", [1, 32, true]);
  assert.equal((await rpc(guest, "get_booking_policy")).payment_deadline_minutes, 32);
  await rpc(admin, "admin_set_booking_policy", [null, null, false]);
  assert.deepEqual(await rpc(guest, "get_booking_policy"), {
    enabled: false,
    request_expiry_minutes: null,
    payment_deadline_minutes: null,
  });
});

test("near-start slots and forged requests are rejected on the same 32-minute boundary", async () => {
  const item = await fixture(32 * 60 - 1);
  await assert.rejects(
    () => request(item),
    (error) => error.code === "QL001",
  );
  const slots = await db.query(
    "select * from public.list_booking_slots($1,now(),now()+interval '1 day')",
    [item.id],
  );
  assert.equal(slots.rows.length, 2);
  assert.ok(slots.rows.every((slot) => slot.starts_at.toISOString() !== item.start));
  const available = { ...item, start: slots.rows[0].starts_at.toISOString() };
  const id = await request(available);
  const booking = await row(id);
  assert.equal(
    new Date(booking.starts_at).getTime() - new Date(booking.request_expires_at).getTime(),
    32 * 60_000,
  );
  await rpc(host, "respond_booking", [id, "accept"]);
  const accepted = await row(id);
  assert.equal(accepted.status, "awaiting_payment");
  assert.equal(accepted.payment_deadline_at.toISOString(), accepted.starts_at.toISOString());
});

test("an aging historical request cannot be accepted near the start, but can be declined", async () => {
  const item = await fixture(31 * 60);
  const id = randomUUID();
  // An earlier request can age into the cutoff. Capture its original dates and
  // acknowledgments together; never move an already acknowledged booking.
  await db.query(
    `with historical as (
      insert into public.bookings(id,listing_id,host_id,guest_id,starts_at,ends_at,status,
        amount_cents,request_expires_at,policy_request_expiry_minutes,policy_payment_deadline_minutes,created_at)
      values($1,$2,$3,$4,$5,$5::timestamptz+interval '1 minute','requested',10000,
        now()+interval '30 minutes',1440,1440,now()-interval '1 day')
      returning id,listing_id)
    insert into private.booking_participation(booking_id,kind,age_at_experience,rules_snapshot,
      adult_booker_confirmed,rules_accepted,guardian_authority_confirmed,guardian_presence_accepted,
      account_attestation_version,accepted_at)
    select h.id,'self',30,l.participation_rules,true,true,false,false,'adult_account_v1',now()-interval '1 day'
      from historical h join public.listings l on l.id=h.listing_id`,
    [id, item.id, host, guest, item.start],
  );
  const before = await row(id);
  await assert.rejects(
    () => rpc(host, "respond_booking", [id, "accept"]),
    (error) => error.code === "QL001",
  );
  const after = await row(id);
  assert.equal(after.status, "requested");
  assert.equal(after.payment_deadline_at, null);
  assert.equal(after.request_expires_at.toISOString(), before.request_expires_at.toISOString());
  await rpc(host, "respond_booking", [id, "decline"]);
  assert.equal((await row(id)).status, "declined");
});

test("legacy short policy closes new requests without rewriting historical captured terms", async () => {
  const item = await fixture();
  const id = await request(item);
  await db.query("update public.bookings set policy_payment_deadline_minutes=30 where id=$1", [id]);
  await db.exec("update private.booking_policy set payment_deadline_minutes=30");
  const read = await rpc(guest, "get_booking_policy");
  assert.equal(read.enabled, false);
  assert.equal(read.payment_deadline_minutes, 30);
  await assert.rejects(
    () => request(item),
    (error) => error.code === "55000",
  );
  assert.deepEqual(
    (
      await db.query("select * from public.list_booking_slots($1,now(),now()+interval '1 day')", [
        item.id,
      ])
    ).rows,
    [],
  );
  await assert.rejects(
    () => rpc(host, "respond_booking", [id, "accept"]),
    (error) => error.code === "QL001",
  );
  assert.equal((await row(id)).policy_payment_deadline_minutes, 30);
  await rpc(host, "respond_booking", [id, "decline"]);
  assert.equal((await row(id)).status, "declined");
});

test("later policy changes do not extend an already accepted payment deadline", async () => {
  const item = await fixture();
  await rpc(admin, "admin_set_booking_policy", [1440, 32, true]);
  const id = await request(item);
  await rpc(host, "respond_booking", [id, "accept"]);
  const captured = (await row(id)).payment_deadline_at.toISOString();
  await rpc(admin, "admin_set_booking_policy", [1440, 1440, true]);
  assert.equal((await row(id)).payment_deadline_at.toISOString(), captured);
});

test("reviewed SQL terms expose the existing session separately from the creation cutoff", async () => {
  const item = await fixture();
  const id = await request(item);
  await rpc(host, "respond_booking", [id, "accept"]);
  const policyId = randomUUID();
  await db.query(
    `insert into private.commercial_policies(id,environment,standard_fee_bps,founder_fee_bps,processing_allocation,payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,terms_version,cancellation_terms,approved_by)
    values($1,'sandbox',1750,1000,'platform_absorbs',48,false,0,0,'fixture','Isolated test terms only',$2)`,
    [policyId, admin],
  );
  await db.query(
    "insert into private.commercial_settings(environment,policy_id,enabled) values('sandbox',$1,true)",
    [policyId],
  );
  const review = () =>
    asRole(db, "service_role", null, async () =>
      checkoutTermsSchema.parse(
        (await db.query("select public.pay_checkout_terms($1,$2,'sandbox') as value", [guest, id]))
          .rows[0].value,
      ),
    );
  assert.equal(checkoutWindow(await review()).mode, "new");
  await db.query(
    "update public.bookings set payment_deadline_at=now()+interval '2 minutes' where id=$1",
    [id],
  );
  assert.equal(checkoutWindow(await review()).mode, "closed");
  await db.query(
    `insert into private.payment_attempts(booking_id,environment,guest_id,host_id,account_id,amount_cents,currency,commission_bps,commission_cents,policy_id,state,session_id,expires_at,terms_accepted_at)
    values($1,'sandbox',$2,$3,'acct_fixture',10000,'usd',1750,1750,$4,'open','cs_test_fixture',now()+interval '2 minutes',now())`,
    [id, guest, host, policyId],
  );
  assert.equal(checkoutWindow(await review()).mode, "resume");
  await db.query("update private.payment_attempts set state='processing' where booking_id=$1", [
    id,
  ]);
  assert.equal(checkoutWindow(await review()).mode, "reconciling");
});
