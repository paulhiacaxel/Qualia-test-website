import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import {
  createTestDatabase,
  asRole,
  attestFixtureAdult,
  acceptFixtureLegal,
  approveFixtureSafety,
} from "../database/helpers.mjs";
let db;
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
    "insert into public.listings(id,host_id,title,category,price_cents,duration_minutes,city) values ($1,$2,'Private <lesson>','art',10000,60,'Miami')",
    [listing, host],
  );
  await approveFixtureSafety(db, { listingId: listing, hostId: host, adminId: admin });
  await db.query(
    `insert into private.commercial_policies(id,environment,standard_fee_bps,founder_fee_bps,processing_allocation,payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,terms_version,cancellation_terms,approved_by)
    values($1,'sandbox',1500,1000,'platform_absorbs',24,false,1,10,'test','Test cancellation terms only',$2)`,
    [policy, host],
  );
});
after(async () => db.close());
beforeEach(async () => db.exec("delete from private.email_outbox"));
async function booking(hours = 48) {
  const id = randomUUID();
  // Keep booking and explicit participation evidence in the same transaction,
  // including when the caller is testing transaction rollback.
  await db.query(
    `with requested as (
    insert into public.bookings(id,listing_id,host_id,guest_id,starts_at,ends_at,amount_cents,listing_title_snapshot,request_expires_at)
    values ($1,$2,$3,$4,now()+$5*interval '1 hour',now()+($5+1)*interval '1 hour',10000,'Private lesson',now()+interval '12 hours')
    returning id,listing_id)
    insert into private.booking_participation(booking_id,kind,age_at_experience,rules_snapshot,
    adult_booker_confirmed,rules_accepted,guardian_authority_confirmed,guardian_presence_accepted,account_attestation_version)
    select requested.id,'self',30,l.participation_rules,true,true,false,false,'adult_account_v1'
    from requested join public.listings l on l.id=requested.listing_id`,
    [id, listing, host, guest, hours],
  );
  return id;
}
async function markPaid(id) {
  await db.query(
    `insert into private.payment_attempts(booking_id,environment,guest_id,host_id,account_id,amount_cents,currency,commission_bps,commission_cents,policy_id,state,expires_at,paid_at,terms_accepted_at)
    values($1,'sandbox',$2,$3,'acct_test',10000,'usd',1500,1500,$4,'paid',now()+interval '2 hours',now(),now())`,
    [id, guest, host, policy],
  );
  await db.query("update public.bookings set status='confirmed' where id=$1", [id]);
}
async function claim(limit = 5) {
  return asRole(
    db,
    "service_role",
    null,
    async () => (await db.query("select * from public.email_claim_jobs($1)", [limit])).rows,
  );
}
async function context(job) {
  return (
    await db.query("select public.email_job_context($1,$2) as value", [job.id, job.lease_token])
  ).rows[0].value;
}
const payload = {
  from: "sender@example.test",
  to: ["guest@example.test"],
  subject: "Test",
  html: "<p>Test</p>",
  text: "Test",
};

test("booking transaction queues host request once and rollback leaves no email", async () => {
  const id = await booking();
  await db.query("update public.bookings set status='requested' where id=$1", [id]);
  const { rows } = await db.query(
    "select recipient_id,kind from private.email_outbox where booking_id=$1",
    [id],
  );
  assert.deepEqual(rows, [{ recipient_id: host, kind: "new_request" }]);
  await db.exec("begin");
  const rolledBack = await booking();
  await db.exec("rollback");
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from private.email_outbox where booking_id=$1",
        [rolledBack],
      )
    ).rows[0].count,
    0,
  );
});

test("anonymous and authenticated clients cannot read/write outbox or invoke worker RPC", async () => {
  for (const role of ["anon", "authenticated"]) {
    await asRole(db, role, guest, async () => {
      await assert.rejects(
        () => db.query("select * from private.email_outbox"),
        (e) => e.code === "42501",
      );
      await assert.rejects(
        () => db.query("select * from public.email_claim_jobs(1)"),
        (e) => e.code === "42501",
      );
      await assert.rejects(
        () =>
          db.query("select public.email_prepare_send($1,$2,$3)", [
            randomUUID(),
            randomUUID(),
            payload,
          ]),
        (e) => e.code === "42501",
      );
    });
  }
});

test("acceptance emails require checkout; stale request jobs skip, confirmed event is separate", async () => {
  const id = await booking();
  await db.query(
    "update public.bookings set status='awaiting_payment',payment_deadline_at=now()+interval '2 hours' where id=$1",
    [id],
  );
  const jobs = await claim();
  const values = await Promise.all(jobs.map(context));
  assert.equal(values.filter(Boolean).length, 1);
  assert.equal(values.find(Boolean).kind, "accepted");
  const confirmations = await db.query(
    "select count(*)::int as count from private.email_outbox where kind='confirmed'",
  );
  assert.equal(confirmations.rows[0].count, 0);
});

test("claim leases prevent duplicate workers and expired lease recovery rejects old tokens", async () => {
  await booking();
  const [first] = await claim();
  assert.deepEqual(await claim(), []);
  await db.query(
    "update private.email_outbox set lease_until=now()-interval '1 minute' where id=$1",
    [first.id],
  );
  const [reclaimed] = await claim();
  assert.equal(reclaimed.id, first.id);
  assert.notEqual(reclaimed.lease_token, first.lease_token);
  assert.equal(await context(first), null);
  assert.equal(
    (
      await db.query(
        "select public.email_finish_job($1,$2,'accepted','provider-id',null) as done",
        [first.id, first.lease_token],
      )
    ).rows[0].done,
    false,
  );
});

test("payload freezes before sending; retry preserves key/payload and records acceptance rather than delivery", async () => {
  await booking();
  const [job] = await claim();
  const prepare = async (value) =>
    (
      await db.query("select public.email_prepare_send($1,$2,$3) as payload", [
        job.id,
        job.lease_token,
        value,
      ])
    ).rows[0].payload;
  assert.deepEqual(await prepare(payload), payload);
  assert.deepEqual(await prepare({ ...payload, subject: "changed" }), payload);
  await db.query("select public.email_finish_job($1,$2,'retry',null,'provider_http_429')", [
    job.id,
    job.lease_token,
  ]);
  assert.deepEqual(await claim(), []);
  await db.query(
    "update private.email_outbox set available_at=now()-interval '1 minute' where id=$1",
    [job.id],
  );
  const [retry] = await claim();
  assert.equal(retry.id, job.id);
  assert.deepEqual((await context(retry)).provider_payload, payload);
  await db.query("select public.email_finish_job($1,$2,'accepted','resend-id',null)", [
    retry.id,
    retry.lease_token,
  ]);
  const row = (
    await db.query("select status,provider_id,accepted_at from private.email_outbox where id=$1", [
      job.id,
    ])
  ).rows[0];
  assert.equal(row.status, "accepted");
  assert.equal(row.provider_id, "resend-id");
  assert.ok(row.accepted_at);
});

test("ambiguous attempts stop before provider idempotency expires", async () => {
  await booking();
  const [job] = await claim();
  await db.query(
    "update private.email_outbox set first_send_at=now()-interval '23 hours',lease_until=now()-interval '1 second' where id=$1",
    [job.id],
  );
  assert.deepEqual(await claim(), []);
  assert.equal(
    (await db.query("select status from private.email_outbox where id=$1", [job.id])).rows[0]
      .status,
    "review",
  );
});

test("cancelled bookings never pass reminder preflight and both participants receive cancellation", async () => {
  // Seed a start inside the reminder window; captured participation dates stay fixed.
  const id = await booking(23);
  await markPaid(id);
  // Represent reminders queued when this synthetic booking was confirmed earlier.
  // The separate confirmation test covers automatic reminder creation itself.
  await db.query(
    `insert into private.email_outbox(booking_id,recipient_id,kind,event_key,scheduled_starts_at,available_at,created_at)
    select b.id,recipient,'reminder_24h',extract(epoch from b.starts_at)::text,b.starts_at,
      b.starts_at-interval '24 hours',now()-interval '2 hours'
    from public.bookings b cross join lateral unnest(array[b.guest_id,b.host_id]) as recipient
    where b.id=$1`,
    [id],
  );
  const claimed = await claim();
  await db.query("update public.bookings set status='cancelled' where id=$1", [id]);
  const rows = (
    await db.query(
      "select * from private.email_outbox where booking_id=$1 and kind='reminder_24h'",
      [id],
    )
  ).rows;
  for (const row of rows) {
    if (row.lease_token) assert.equal(await context(row), null);
  }
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from private.email_outbox where booking_id=$1 and kind='cancelled'",
        [id],
      )
    ).rows[0].count,
    2,
  );
  assert.ok(rows.length === 2);
  assert.ok(claimed.some((job) => rows.some((row) => row.id === job.id)));
});

test("confirmation requires paid ledger; replayed paid transition cannot duplicate event", async () => {
  const unpaid = await booking();
  await db.query("update public.bookings set status='confirmed' where id=$1", [unpaid]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from private.email_outbox where booking_id=$1 and kind in ('confirmed','reminder_24h')",
        [unpaid],
      )
    ).rows[0].count,
    0,
  );
  const paid = await booking();
  await markPaid(paid);
  await db.query("update public.bookings set status='confirmed' where id=$1", [paid]);
  const { rows } = await db.query(
    "select kind,count(*)::int as count from private.email_outbox where booking_id=$1 group by kind order by kind",
    [paid],
  );
  assert.deepEqual(rows, [
    { kind: "confirmed", count: 2 },
    { kind: "new_request", count: 1 },
    { kind: "reminder_24h", count: 2 },
  ]);
});
