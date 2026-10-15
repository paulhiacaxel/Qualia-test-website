/** Executes the exact local-only SQL against all real migrations. No provider is contacted. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import { asRole, createTestDatabase, adultParticipant } from "../database/helpers.mjs";
import { seedSql, markerSql, advanceSql, evidenceSql } from "../../scripts/rehearsal/fixtures.mjs";
import { assertEvidence } from "../../scripts/rehearsal/guards.mjs";

let db;
const state = { run: randomUUID(), host: randomUUID(), guest: randomUUID(), listing: randomUUID() };
const member = (id, fn) => asRole(db, "authenticated", id, fn);
const server = (fn) => asRole(db, "service_role", null, fn);
async function rpc(name, args) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      args,
    )
  ).rows[0].result;
}
before(async () => {
  db = await createTestDatabase();
  for (const id of [state.host, state.guest])
    await db.query("insert into auth.users(id,email_confirmed_at) values($1,now())", [id]);
  await db.exec(seedSql(state, "acct_localFixture"));
});
after(async () => db.close());
test("isolated seed uses current schema and approved policy values without touching an existing database", async () => {
  assert.equal((await db.query(markerSql(state))).rows[0].matches, 1);
  const policy = (await db.query("select * from private.commercial_policies")).rows[0];
  assert.equal(policy.payout_delay_hours, 48);
  assert.equal(policy.standard_fee_bps, 1750);
  assert.equal(policy.founder_free_bookings, 3);
  assert.equal(policy.founder_duration_months, 3);
  await assert.rejects(() => db.exec(seedSql(state, "acct_other")), /empty marketplace/);
  for (const role of ["anon", "authenticated", "service_role"])
    await assert.rejects(
      () => asRole(db, role, state.host, () => db.query("select * from qualia_rehearsal.fixture")),
      /permission denied/,
    );
});
test("real request/accept/payment commands preserve captured participant dates and refuse fast-forwarding", async () => {
  const start = (
    await db.query("select starts_at from public.availability_windows order by starts_at limit 1")
  ).rows[0].starts_at;
  const booking = await member(state.guest, () =>
    rpc("request_booking", [state.listing, start, "Local acceptance", adultParticipant()]),
  );
  await member(state.host, () => rpc("respond_booking", [booking, "accept"]));
  await assert.rejects(() => db.exec(advanceSql(state, booking)), /confirmed local fixture/);
  const terms = await server(() => rpc("pay_checkout_terms", [state.guest, booking, "sandbox"]));
  const quote = await server(() =>
    rpc("pay_reserve_checkout", [state.guest, booking, "sandbox", terms.policy_id, true]),
  );
  // These canonical facts are synthetic in this offline SQL test only. The runner
  // never fabricates them: its operator must pay actual Stripe sandbox Checkout.
  await server(() =>
    rpc("pay_attach_checkout", [
      quote.attempt_id,
      "cs_test_local",
      "pi_local",
      "https://checkout.stripe.com/c/pay/cs_test_local",
      quote.expires_at,
    ]),
  );
  const event = await server(() =>
    rpc("pay_ingest_event", [
      "sandbox",
      "platform",
      "evt_local",
      "checkout.session.completed",
      "cs_test_local",
    ]),
  );
  await server(() =>
    rpc("pay_apply_payment", [
      event.event_key,
      quote.attempt_id,
      "cs_test_local",
      "pi_local",
      "ch_local",
      10000,
      "usd",
      "paid",
      320,
    ]),
  );
  const original = (await db.query("select * from public.bookings where id=$1", [booking])).rows[0];
  await assert.rejects(
    () => db.exec(advanceSql({ ...state, run: randomUUID() }, booking)),
    /Wrong rehearsal marker/,
  );
  await assert.rejects(() => db.exec(advanceSql(state, randomUUID())), /confirmed local fixture/);
  await db.query("update private.payment_attempts set environment='live' where id=$1", [
    quote.attempt_id,
  ]);
  await assert.rejects(() => db.exec(advanceSql(state, booking)), /verified sandbox payment/);
  await db.query("update private.payment_attempts set environment='sandbox' where id=$1", [
    quote.attempt_id,
  ]);
  await assert.rejects(
    () => db.exec(advanceSql(state, booking)),
    /Captured participant dates cannot be fast-forwarded/,
  );
  const preserved = (await db.query("select * from public.bookings where id=$1", [booking]))
    .rows[0];
  assert.equal(preserved.starts_at.getTime(), original.starts_at.getTime());
  assert.equal(preserved.ends_at.getTime(), original.ends_at.getTime());
  assert.equal(preserved.status, "confirmed");
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from qualia_rehearsal.time_advances where booking_id=$1",
        [booking],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from private.booking_participation where booking_id=$1",
        [booking],
      )
    ).rows[0].count,
    1,
  );
  await server(() => rpc("pay_finish_event", [event.event_key, null]));
  assertEvidence((await db.query(evidenceSql(state, booking))).rows[0], "paid");
});

test("legacy paid fixtures without participant snapshots retain scoped single-use advancement and settlement checks", async () => {
  // Explicit historical synthetic state, equivalent to a pre-participation booking.
  // No acknowledged booking is copied, altered or stripped of its snapshot. This
  // proves backwards-compatible financial behavior, not a new provider rehearsal.
  const booking = randomUUID();
  const quote = { attempt_id: randomUUID() };
  await db.query(
    `insert into public.bookings(id,listing_id,host_id,guest_id,starts_at,ends_at,status,
    amount_cents,currency,payment_deadline_at,policy_request_expiry_minutes,policy_payment_deadline_minutes)
    values($1,$2,$3,$4,now()+interval '2 days',now()+interval '2 days 1 hour','confirmed',
      10000,'usd',now()+interval '2 hours',1440,1440)`,
    [booking, state.listing, state.host, state.guest],
  );
  await db.query(
    `insert into private.payment_attempts(id,booking_id,environment,guest_id,host_id,account_id,
      amount_cents,currency,commission_bps,commission_cents,policy_id,state,terms_accepted_at,expires_at,
      session_id,payment_intent_id,charge_id,processor_fee_cents,received_amount_cents,received_currency,paid_at)
    select $1,$2,'sandbox',$3,$4,'acct_localFixture',10000,'usd',1750,1750,policy_id,'paid',now(),now()+interval '2 hours',
      'cs_test_legacy','pi_legacy','ch_legacy',320,10000,'usd',now()
      from private.commercial_settings where environment='sandbox'`,
    [quote.attempt_id, booking, state.guest, state.host],
  );
  const event = await server(() =>
    rpc("pay_ingest_event", [
      "sandbox",
      "platform",
      "evt_legacy",
      "checkout.session.completed",
      "cs_test_legacy",
    ]),
  );
  const original = (await db.query("select * from public.bookings where id=$1", [booking])).rows[0];
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from private.booking_participation where booking_id=$1",
        [booking],
      )
    ).rows[0].count,
    0,
  );
  await db.exec(advanceSql(state, booking));
  const shifted = (await db.query("select * from public.bookings where id=$1", [booking])).rows[0];
  assert.equal(shifted.ends_at - shifted.starts_at, original.ends_at - original.starts_at);
  assert.ok(shifted.ends_at < new Date(Date.now() - 48 * 3600000));
  assert.equal(shifted.status, "confirmed");
  assert.equal(shifted.payment_deadline_at.getTime(), original.payment_deadline_at.getTime());
  await assert.rejects(() => db.exec(advanceSql(state, booking)), /duplicate key/);
  const unchanged = (
    await db.query("select * from private.payment_attempts where id=$1", [quote.attempt_id])
  ).rows[0];
  assert.equal(unchanged.state, "paid");
  assert.equal(unchanged.processor_fee_cents, 320);
  assert.equal(unchanged.commission_bps, 1750);
  await server(() => rpc("pay_finish_event", [event.event_key, null]));
  await server(() => rpc("pay_complete_booking", [state.host, booking]));
  const release = await server(() =>
    rpc("pay_prepare_release", [state.host, booking, randomUUID()]),
  );
  assert.equal(release.amount_cents, 7930);
  const evidence = (await db.query(evidenceSql(state, booking))).rows[0];
  assert.equal(evidence.booking_status, "completed");
  assert.equal(evidence.pending_operations, 1);
  await server(() =>
    rpc("pay_record_operation", [release.operation_id, "tr_local", "succeeded", null]),
  );
  const refund = await server(() =>
    rpc("pay_prepare_refund", [
      state.host,
      booking,
      10000,
      "Local test refund",
      randomUUID(),
      quote.attempt_id,
    ]),
  );
  await server(() =>
    rpc("pay_record_operation", [refund.operation_id, "re_local", "succeeded", null]),
  );
  await server(() =>
    rpc("pay_record_operation", [
      refund.reversal_operation.operation_id,
      "trr_local",
      "succeeded",
      null,
    ]),
  );
  const refunded = (await db.query(evidenceSql(state, booking))).rows[0];
  assert.equal(refunded.booking_status, "cancelled");
  assert.equal(refunded.state, "paid"); // Successful refund is a separate ledger operation.
  assertEvidence(refunded, "refunded");
});
