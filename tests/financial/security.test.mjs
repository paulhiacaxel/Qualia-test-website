/** Independent financial invariant tests. All amounts are synthetic USD cents;
 * no Stripe API is invoked and no hosted database is contacted.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  createTestDatabase,
  asRole,
  attestFixtureAdult,
  acceptFixtureLegal,
  approveFixtureSafety,
} from "../database/helpers.mjs";

let db;
let admin;
let guest;
let stranger;
let serial = 0;
const rpc = (name, args = []) =>
  db.query(
    `select * from public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")})`,
    args,
  );
const value = async (name, args = []) => (await rpc(name, args)).rows[0][name];
const server = (fn) => asRole(db, "service_role", null, fn);
const member = (id, fn) => asRole(db, "authenticated", id, fn);
const denied = (fn) => assert.rejects(fn, (error) => error.code === "42501");
const rejected = (fn, code = "55000") => assert.rejects(fn, (error) => error.code === code);
const token = (prefix) => `${prefix}_${++serial}${randomUUID().replaceAll("-", "")}`;
const settings = (override = {}) => ({
  environment: "sandbox",
  enabled: true,
  standard_fee_bps: 1500,
  founder_fee_bps: 1000,
  founder_free_bookings: 10,
  founder_duration_months: 6,
  founder_cohort_cap: 1000,
  processing_allocation: "platform_absorbs",
  payout_delay_hours: 0,
  restore_refunded_credit: true,
  referral_free_bookings: 1,
  referral_credit_cap: 10,
  terms_version: "synthetic-test-policy",
  cancellation_terms: "Synthetic policy used only for automated financial tests.",
  incentive_start: "host_enrollment",
  cutoff_rule: "checkout_before_cutoff_frozen_quote",
  refund_rule: "proportional_commission_nonrefundable_processing",
  completion_rule: "admin_after_end",
  liability_acknowledged: true,
  ...override,
});

async function makeUser({ host = false } = {}) {
  const id = randomUUID();
  await db.query(
    "insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ($1,$2,now())",
    [id, { full_name: "Synthetic person" }],
  );
  await attestFixtureAdult(db, id);
  await acceptFixtureLegal(db, id, { host });
  if (host) {
    await member(id, async () => {
      await rpc("enable_host_mode");
      await rpc("save_host_profile", ["Synthetic host", "Private Miami lessons.", "Miami", null]);
    });
  }
  return id;
}
async function enablePolicy(override = {}) {
  return member(admin, () => value("admin_set_commercial_policy", [settings(override)]));
}
async function enrollFounder(host, startedAt, policyId) {
  const expected = policyId ?? (await value("admin_get_commercial_policy", ["sandbox"])).policy.id;
  return rpc("admin_enroll_founder", [host, "sandbox", startedAt, expected]);
}
async function publishListing(host) {
  const listing = randomUUID();
  await db.query(
    `insert into public.listings(id,host_id,title,description,category,price_cents,duration_minutes,city,neighborhood)
    values($1,$2,'Synthetic founding listing','Synthetic approved listing.','art',10000,60,'Miami','Wynwood')`,
    [listing, host],
  );
  await approveFixtureSafety(db, { listingId: listing, hostId: host, adminId: admin });
  return listing;
}
async function hostFixture({ founder = false, startedAt } = {}) {
  const host = await makeUser({ host: true });
  const account = await server(() => value("pay_prepare_account", [host, "sandbox"]));
  const accountId = token("acct");
  await server(() => rpc("pay_attach_account", [account.operation_id, accountId]));
  await server(() => rpc("pay_sync_account", [accountId, "sandbox", true, true, []]));
  if (founder) {
    await publishListing(host);
    await member(admin, () => enrollFounder(host, startedAt ?? new Date().toISOString()));
  }
  return { host, accountId };
}
async function acceptedBooking(host, { amount = 10000, guestId = guest, startsAt } = {}) {
  const listing = randomUUID();
  const id = randomUUID();
  const start = startsAt ? new Date(startsAt) : new Date(Date.now() + (++serial + 5) * 86400000);
  const end = new Date(start.getTime() + 3600000);
  await db.query(
    `insert into public.listings(id,host_id,title,description,category,price_cents,duration_minutes,city,neighborhood)
    values ($1,$2,'Synthetic experience','A test-only listing.','art',$3,60,'Miami','Wynwood')`,
    [listing, host, amount],
  );
  await approveFixtureSafety(db, { listingId: listing, hostId: host, adminId: admin });
  // Seed an already accepted booking and its explicit adult participation evidence
  // atomically. Money tests still exercise checkout, reconciliation and refunds.
  await db.query(
    `with accepted as (
    insert into public.bookings(id,listing_id,host_id,guest_id,starts_at,ends_at,status,amount_cents,currency,
    request_expires_at,payment_deadline_at,listing_title_snapshot,policy_request_expiry_minutes,policy_payment_deadline_minutes)
    values ($1,$2,$3,$4,$5,$6,'awaiting_payment',$7,'usd',now()+interval '2 hours',now()+interval '2 hours','Synthetic experience',120,120)
    returning id,listing_id)
    insert into private.booking_participation(booking_id,kind,age_at_experience,rules_snapshot,
    adult_booker_confirmed,rules_accepted,guardian_authority_confirmed,guardian_presence_accepted,account_attestation_version,accepted_at)
    select accepted.id,'self',30,l.participation_rules,true,true,false,false,'adult_account_v1',
    least(now(),$5::timestamptz-interval '1 day')
    from accepted join public.listings l on l.id=accepted.listing_id`,
    [id, listing, host, guestId, start, end, amount],
  );
  return id;
}
async function reserve(booking, actor = guest) {
  return server(async () => {
    const terms = await value("pay_checkout_terms", [actor, booking, "sandbox"]);
    return value("pay_reserve_checkout", [actor, booking, "sandbox", terms.policy_id, true]);
  });
}
async function attach(attempt) {
  const session = token("cs_test");
  const paymentIntent = token("pi");
  await server(() =>
    rpc("pay_attach_checkout", [
      attempt.attempt_id,
      session,
      paymentIntent,
      `https://checkout.stripe.com/c/pay/${session}`,
      attempt.expires_at,
    ]),
  );
  return { ...attempt, session, paymentIntent, charge: token("ch") };
}
async function eventFor(attempt, { eventId = token("evt"), environment = "sandbox" } = {}) {
  return server(() =>
    value("pay_ingest_event", [
      environment,
      "platform",
      eventId,
      "checkout.session.completed",
      attempt.session,
    ]),
  );
}
async function apply(
  attempt,
  { state = "paid", amount = attempt.amount_cents, event, fee = 320 } = {},
) {
  const inbox = event ?? (await eventFor(attempt));
  const result = await server(() =>
    value("pay_apply_payment", [
      inbox.event_key,
      attempt.attempt_id,
      attempt.session,
      ["paid", "processing"].includes(state) ? attempt.paymentIntent : null,
      state === "paid" ? attempt.charge : null,
      amount,
      "usd",
      state,
      state === "paid" ? fee : null,
    ]),
  );
  return { result, event: inbox };
}
async function paidBooking(host, options) {
  const booking = await acceptedBooking(host, options);
  const attempt = await attach(await reserve(booking));
  await apply(attempt);
  return { booking, attempt };
}

/**
 * Settlement tests need an experience that already ended. Seed explicit synthetic
 * payment history at its original date instead of moving an acknowledged booking.
 * Checkout and canonical confirmation remain covered by paidBooking tests above.
 */
async function historicalAttempt(booking, state = "paid") {
  const attemptId = randomUUID();
  const session = token("cs_test");
  const paymentIntent = token("pi");
  const charge = token("ch");
  await db.query(
    `insert into private.payment_attempts(id,booking_id,environment,guest_id,host_id,account_id,
    amount_cents,currency,commission_bps,commission_cents,policy_id,state,terms_accepted_at,expires_at,
    session_id,payment_intent_id,charge_id,processor_fee_cents,received_amount_cents,received_currency,paid_at,created_at)
    select $1,b.id,'sandbox',b.guest_id,b.host_id,a.account_id,b.amount_cents,b.currency,
    p.standard_fee_bps,floor(b.amount_cents::numeric*p.standard_fee_bps/10000)::integer,p.id,$3,
    b.starts_at-interval '1 day',b.starts_at,$4,$5,case when $3='paid' then $6 end,
    case when $3='paid' then 320 end,case when $3='paid' then b.amount_cents end,
    case when $3='paid' then b.currency end,case when $3='paid' then b.starts_at-interval '1 hour' end,
    b.starts_at-interval '1 day'
    from public.bookings b join private.stripe_accounts a on a.host_id=b.host_id and a.environment='sandbox'
    join private.commercial_settings s on s.environment='sandbox'
    join private.commercial_policies p on p.id=s.policy_id where b.id=$2`,
    [attemptId, booking, state, session, paymentIntent, charge],
  );
  const attempt = (
    await db.query("select private.financial_attempt_json($1) as value", [attemptId])
  ).rows[0].value;
  assert.ok(attempt, "Historical settlement fixture must have a captured account and policy");
  return { ...attempt, session, paymentIntent, charge };
}
async function historicalPaidBooking(host) {
  const booking = await acceptedBooking(host, {
    startsAt: new Date(Date.now() - 2 * 3600000),
  });
  const attempt = await historicalAttempt(booking);
  await db.query("update public.bookings set status='confirmed' where id=$1", [booking]);
  return { booking, attempt };
}

before(async () => {
  db = await createTestDatabase();
  admin = await makeUser();
  guest = await makeUser();
  stranger = await makeUser();
  await db.query(
    "insert into private.admin_memberships(user_id,reason) values ($1,'Synthetic test operator')",
    [admin],
  );
});
after(async () => db.close());

test("browser roles, including admins, cannot invoke service-only money commands or read private policy tables", async () => {
  for (const identity of [null, guest, admin]) {
    await asRole(db, identity ? "authenticated" : "anon", identity, async () => {
      for (const [name, args] of [
        ["pay_prepare_account", [guest, "sandbox"]],
        ["pay_reserve_checkout", [guest, randomUUID(), "sandbox", randomUUID(), true]],
        ["pay_read_booking", [guest, randomUUID()]],
        ["pay_prepare_refund", [admin, randomUUID(), 1, "Test", randomUUID(), randomUUID()]],
      ])
        await denied(() => rpc(name, args));
      await denied(() => db.query("select * from private.commercial_policies"));
      await denied(() => db.query("select * from private.payment_attempts"));
      await denied(() => db.query("select * from private.stripe_accounts"));
    });
  }
  await member(guest, () => denied(() => rpc("admin_set_commercial_policy", [settings()])));
});

test("checkout fails closed before policy approval, rechecks actor ownership and preserves one stable attempt", async () => {
  const host = await hostFixture();
  const booking = await acceptedBooking(host.host);
  await rejected(() => reserve(booking));
  await enablePolicy();
  await denied(() => reserve(booking, stranger));
  const terms = await server(() => value("pay_checkout_terms", [guest, booking, "sandbox"]));
  await assert.rejects(() =>
    server(() => rpc("pay_reserve_checkout", [guest, booking, "sandbox", terms.policy_id, false])),
  );
  await assert.rejects(() =>
    server(() => rpc("pay_reserve_checkout", [guest, booking, "sandbox", null, true])),
  );
  const first = await reserve(booking);
  const retry = await reserve(booking);
  assert.equal(first.attempt_id, retry.attempt_id);
  assert.equal(first.commission_cents, 1500);
  assert.equal(first.amount_cents, 10000);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from private.payment_attempts where booking_id=$1",
        [booking],
      )
    ).rows[0].n,
    1,
  );
  await server(() => denied(() => rpc("pay_prepare_release", [stranger, booking, randomUUID()])));
});

test("in-flight checkout preserves the host hold beyond local deadlines and blocks unpaid cancellation", async () => {
  const host = await hostFixture();
  const booking = await acceptedBooking(host.host);
  await attach(await reserve(booking));
  await db.query(
    "update public.bookings set payment_deadline_at=now()-interval '1 minute' where id=$1",
    [booking],
  );
  await member(guest, () => rejected(() => rpc("cancel_unpaid_booking", [booking])));
  const details = await member(guest, () => value("get_booking_details", [booking]));
  assert.equal(details.booking.status, "awaiting_payment");
  await db.exec("begin");
  try {
    await reserve(booking);
    const { rows } = await db.query(
      "select granted,mode from pg_locks where locktype='advisory' and classid=72461 and objid=hashtext($1)::oid",
      [host.host],
    );
    assert.deepEqual(rows, [{ granted: true, mode: "ExclusiveLock" }]);
  } finally {
    await db.exec("rollback");
  }
});

test("verified canonical payment confirms once, duplicate delivery is idempotent, and failed events remain retryable", async () => {
  const host = await hostFixture();
  const booking = await acceptedBooking(host.host);
  const attempt = await attach(await reserve(booking));
  const captured = (
    await db.query(
      `select a.guest_legal_acceptance_id as payment_guest,a.host_legal_acceptance_id as payment_host,
      b.guest_legal_acceptance_id as booking_guest,b.host_legal_acceptance_id as booking_host,
      g.id as trusted_guest,h.id as trusted_host
      from private.payment_attempts a join public.bookings b on b.id=a.booking_id
      join private.legal_acceptances g on g.user_id=b.guest_id and g.scope='guest'
      join private.legal_acceptances h on h.user_id=b.host_id and h.scope='host'
      where a.id=$1`,
      [attempt.attempt_id],
    )
  ).rows[0];
  assert.ok(captured.trusted_guest);
  assert.ok(captured.trusted_host);
  assert.equal(captured.payment_guest, captured.trusted_guest);
  assert.equal(captured.booking_guest, captured.trusted_guest);
  assert.equal(captured.payment_host, captured.trusted_host);
  assert.equal(captured.booking_host, captured.trusted_host);
  for (const column of ["guest_legal_acceptance_id", "host_legal_acceptance_id"])
    await denied(() =>
      db.query(`update private.payment_attempts set ${column}=null where id=$1`, [
        attempt.attempt_id,
      ]),
    );
  const eventId = token("evt");
  const inbox = await eventFor(attempt, { eventId });
  await server(() => rpc("pay_finish_event", [inbox.event_key, "Synthetic temporary failure"]));
  assert.equal((await eventFor(attempt, { eventId })).status, "failed");
  await apply(attempt, { event: inbox });
  await server(() => rpc("pay_finish_event", [inbox.event_key, null]));
  const duplicate = await eventFor(attempt, { eventId });
  assert.equal(duplicate.status, "processed");
  await apply(attempt, { event: duplicate });
  assert.equal(
    (await db.query("select status from public.bookings where id=$1", [booking])).rows[0].status,
    "confirmed",
  );
  assert.equal(
    (await db.query("select state from private.payment_attempts where id=$1", [attempt.attempt_id]))
      .rows[0].state,
    "paid",
  );
  await apply(attempt, { state: "failed" });
  assert.equal(
    (await db.query("select state from private.payment_attempts where id=$1", [attempt.attempt_id]))
      .rows[0].state,
    "paid",
  );
});

test("wrong totals or a late paid slot conflict quarantine money instead of confirming a booking", async () => {
  const host = await hostFixture();
  const wrongBooking = await acceptedBooking(host.host);
  const wrong = await attach(await reserve(wrongBooking));
  await apply(wrong, { amount: wrong.amount_cents - 1 });
  assert.equal(
    (await db.query("select state from private.payment_attempts where id=$1", [wrong.attempt_id]))
      .rows[0].state,
    "quarantined",
  );
  assert.notEqual(
    (await db.query("select status from public.bookings where id=$1", [wrongBooking])).rows[0]
      .status,
    "confirmed",
  );

  const lateBooking = await acceptedBooking(host.host);
  const late = await attach(await reserve(lateBooking));
  await db.query("update public.bookings set status='expired' where id=$1", [lateBooking]);
  const lateStart = (
    await db.query("select starts_at from public.bookings where id=$1", [lateBooking])
  ).rows[0].starts_at;
  const other = await acceptedBooking(host.host, { guestId: stranger, startsAt: lateStart });
  await db.query("update public.bookings set status='confirmed' where id=$1", [other]);
  await apply(late);
  assert.equal(
    (await db.query("select state from private.payment_attempts where id=$1", [late.attempt_id]))
      .rows[0].state,
    "quarantined",
  );
  assert.notEqual(
    (await db.query("select status from public.bookings where id=$1", [lateBooking])).rows[0]
      .status,
    "confirmed",
  );
});

test("the ninth and tenth founding credits are reserved atomically, the eleventh waits, and failed credit is reusable", async () => {
  const host = await hostFixture({ founder: true });
  const attempts = [];
  for (let i = 0; i < 10; i++) {
    const booking = await acceptedBooking(host.host);
    const attempt = await attach(await reserve(booking));
    assert.equal(attempt.commission_cents, 0);
    attempts.push(attempt);
    if (i < 9) await apply(attempt);
  }
  const eleventh = await acceptedBooking(host.host);
  await rejected(() => reserve(eleventh));
  await apply(attempts[9], { state: "failed" });
  const recycled = await attach(await reserve(eleventh));
  assert.equal(recycled.commission_cents, 0);
  await apply(recycled);
  const twelfth = await acceptedBooking(host.host);
  assert.equal((await reserve(twelfth)).commission_cents, 1000);
  const tally = await db.query(
    "select state,count(*)::int as n from private.incentive_reservations where host_id=$1 and kind='founder' group by state order by state",
    [host.host],
  );
  assert.deepEqual(tally.rows, [
    { state: "consumed", n: 10 },
    { state: "released", n: 1 },
  ]);
});

test("six-calendar-month cutoff is exact and a pre-cutoff quote retains its terms after cutoff", async () => {
  const startedAt = (
    await db.query(
      "select (((now() at time zone 'America/New_York') - interval '6 months' + interval '2 minutes') at time zone 'America/New_York') as value",
    )
  ).rows[0].value;
  const host = await hostFixture({ founder: true, startedAt });
  const terms = (
    await db.query(
      "select ends_at, ((starts_at at time zone 'America/New_York') + interval '6 months') at time zone 'America/New_York' as expected from private.host_incentive_terms where host_id=$1",
      [host.host],
    )
  ).rows[0];
  assert.equal(new Date(terms.ends_at).getTime(), new Date(terms.expected).getTime());
  const quoted = await attach(await reserve(await acceptedBooking(host.host)));
  assert.equal(quoted.commission_cents, 0);
  await db.query(
    "update private.host_incentive_terms set ends_at=now()-interval '1 second' where host_id=$1",
    [host.host],
  );
  await apply(quoted);
  assert.equal(
    (
      await db.query("select commission_cents from private.payment_attempts where id=$1", [
        quoted.attempt_id,
      ])
    ).rows[0].commission_cents,
    0,
  );
  assert.equal((await reserve(await acceptedBooking(host.host))).commission_cents, 1000);
  await enablePolicy({ founder_fee_bps: 500 });
  assert.equal((await reserve(await acceptedBooking(host.host))).commission_cents, 1000);
  await enablePolicy();
});

test("refunds preserve paid history, host recovery is separate, and a full refunded founding credit follows captured policy", async () => {
  const host = await hostFixture({ founder: true });
  const { booking, attempt } = await paidBooking(host.host);
  const operationId = randomUUID();
  const refund = await server(() =>
    value("pay_prepare_refund", [
      admin,
      booking,
      10000,
      "Synthetic full refund",
      operationId,
      attempt.attempt_id,
    ]),
  );
  assert.equal(refund.operation_id, operationId);
  assert.equal(refund.kind, "refund");
  assert.equal(refund.amount_cents, 10000);
  await server(() => rpc("pay_record_operation", [operationId, token("re"), "succeeded", null]));
  assert.equal(
    (await db.query("select state from private.payment_attempts where id=$1", [attempt.attempt_id]))
      .rows[0].state,
    "paid",
  );
  assert.equal(
    (await db.query("select status from public.bookings where id=$1", [booking])).rows[0].status,
    "cancelled",
  );
  assert.equal(
    (
      await db.query("select state from private.incentive_reservations where attempt_id=$1", [
        attempt.attempt_id,
      ])
    ).rows[0].state,
    "released",
  );
  await server(() => denied(() => rpc("pay_read_booking", [stranger, booking])));
  const own = await server(() => value("pay_read_booking", [guest, booking]));
  assert.ok(own);
  await server(() =>
    rejected(
      () =>
        rpc("pay_prepare_refund", [
          admin,
          booking,
          1,
          "Over-refund must fail",
          randomUUID(),
          attempt.attempt_id,
        ]),
      "22023",
    ),
  );
});

test("completed host transfer and later refund/reversal are separate durable operations with bounded amounts", async () => {
  const host = await hostFixture();
  const future = await paidBooking(host.host);
  await server(() => rejected(() => rpc("pay_complete_booking", [admin, future.booking])));
  const { booking, attempt } = await historicalPaidBooking(host.host);
  await server(() => rpc("pay_complete_booking", [admin, booking]));
  const transferId = randomUUID();
  const transfer = await server(() => value("pay_prepare_release", [admin, booking, transferId]));
  assert.equal(transfer.amount_cents, 8500);
  assert.equal(transfer.kind, "transfer");
  const stripeTransfer = token("tr");
  await server(() => rpc("pay_record_operation", [transferId, stripeTransfer, "succeeded", null]));
  const refundId = randomUUID();
  const refund = await server(() =>
    value("pay_prepare_refund", [
      admin,
      booking,
      5000,
      "Synthetic partial refund",
      refundId,
      attempt.attempt_id,
    ]),
  );
  assert.equal(refund.amount_cents, 5000);
  assert.ok(refund.reversal_operation);
  assert.equal(refund.reversal_operation.amount_cents, 4250);
  await server(() =>
    rpc("pay_record_operation", [
      refund.reversal_operation.operation_id,
      null,
      "failed",
      "Synthetic host recovery failure",
    ]),
  );
  await server(() => rpc("pay_record_operation", [refundId, token("re"), "succeeded", null]));
  const states = await db.query(
    "select kind,state from private.settlement_operations where booking_id=$1 order by kind",
    [booking],
  );
  assert.deepEqual(states.rows, [
    { kind: "refund", state: "succeeded" },
    { kind: "reversal", state: "failed" },
    { kind: "transfer", state: "succeeded" },
  ]);
  assert.equal(
    (await db.query("select status from public.bookings where id=$1", [booking])).rows[0].status,
    "completed",
  );
  const duplicate = await server(() =>
    value("pay_prepare_refund", [
      admin,
      booking,
      5000,
      "Synthetic partial refund",
      refundId,
      attempt.attempt_id,
    ]),
  );
  assert.equal(duplicate.operation_id, refundId);
  await server(() =>
    rejected(
      () =>
        rpc("pay_prepare_refund", [
          admin,
          booking,
          5001,
          "Cannot exceed remaining balance",
          randomUUID(),
          attempt.attempt_id,
        ]),
      "22023",
    ),
  );
});

async function completePaid(booking) {
  await server(() => rpc("pay_complete_booking", [admin, booking]));
}

test("a failed transfer cannot retry an obsolete amount after a partial refund", async () => {
  const host = await hostFixture();
  const { booking, attempt } = await historicalPaidBooking(host.host);
  await completePaid(booking);
  const oldId = randomUUID();
  await server(() => rpc("pay_prepare_release", [admin, booking, oldId]));
  await server(() =>
    rpc("pay_record_operation", [oldId, null, "failed", "Synthetic terminal failure"]),
  );
  const refundId = randomUUID();
  await server(() =>
    rpc("pay_prepare_refund", [
      admin,
      booking,
      5000,
      "Partial refund before release",
      refundId,
      attempt.attempt_id,
    ]),
  );
  await server(() => rpc("pay_record_operation", [refundId, token("re"), "succeeded", null]));
  await server(() => rejected(() => rpc("pay_prepare_release", [admin, booking, oldId])));
  const replacement = await server(() =>
    value("pay_prepare_release", [admin, booking, randomUUID()]),
  );
  assert.equal(replacement.amount_cents, 4250);
});

test("refund selects the exact duplicate charge and does not reduce the valid host entitlement", async () => {
  const host = await hostFixture();
  const { booking, attempt: second } = await historicalPaidBooking(host.host);
  const first = await historicalAttempt(booking, "failed");
  await apply(first); // A late older charge is quarantined, not allowed to replace payment.
  const refundId = randomUUID();
  const refund = await server(() =>
    value("pay_prepare_refund", [
      admin,
      booking,
      10000,
      "Duplicate charge refund",
      refundId,
      first.attempt_id,
    ]),
  );
  assert.equal(refund.charge_id, first.charge);
  assert.equal(refund.reversal_operation, null);
  await server(() => rpc("pay_record_operation", [refundId, token("re"), "succeeded", null]));
  assert.equal(
    (await db.query("select status from public.bookings where id=$1", [booking])).rows[0].status,
    "confirmed",
  );
  await completePaid(booking);
  // Quarantined attempts remain an explicit operator hold even after refund.
  await server(() => rejected(() => rpc("pay_prepare_release", [admin, booking, randomUUID()])));
  const secondSummary = await db.query(
    "select commission_cents, state from private.payment_attempts where id=$1",
    [second.attempt_id],
  );
  assert.deepEqual(secondSummary.rows, [{ commission_cents: 1500, state: "paid" }]);
});

test("early refund and transfer webhooks attach to one durable operation and reject mismatched evidence", async () => {
  const host = await hostFixture();
  const { booking, attempt } = await historicalPaidBooking(host.host);
  await completePaid(booking);
  const transferId = randomUUID();
  const transfer = await server(() => value("pay_prepare_release", [admin, booking, transferId]));
  const stripeTransfer = token("tr");
  await server(() =>
    rejected(
      () =>
        rpc("pay_sync_transfer", [
          "sandbox",
          stripeTransfer,
          0,
          transferId,
          transfer.amount_cents + 1,
          attempt.charge,
          host.accountId,
        ]),
      "22023",
    ),
  );
  await server(() =>
    rpc("pay_sync_transfer", [
      "sandbox",
      stripeTransfer,
      0,
      transferId,
      transfer.amount_cents,
      attempt.charge,
      host.accountId,
    ]),
  );
  await server(() => rpc("pay_record_operation", [transferId, stripeTransfer, "succeeded", null]));
  const refundId = randomUUID();
  await server(() =>
    rpc("pay_prepare_refund", [
      admin,
      booking,
      2500,
      "Synthetic customer adjustment",
      refundId,
      attempt.attempt_id,
    ]),
  );
  const stripeRefund = token("re");
  await server(() =>
    rejected(
      () =>
        rpc("pay_sync_refund", [
          "sandbox",
          attempt.charge,
          stripeRefund,
          "succeeded",
          2501,
          refundId,
        ]),
      "22023",
    ),
  );
  await server(() =>
    rpc("pay_sync_refund", ["sandbox", attempt.charge, stripeRefund, "succeeded", 2500, refundId]),
  );
  await server(() => rpc("pay_record_operation", [refundId, stripeRefund, "succeeded", null]));
  await server(() =>
    rpc("pay_sync_refund", ["sandbox", attempt.charge, stripeRefund, "succeeded", 2500, refundId]),
  );
  const operations = await db.query(
    "select kind,count(*)::int as n from private.settlement_operations where booking_id=$1 and kind in ('transfer','refund') group by kind order by kind",
    [booking],
  );
  assert.deepEqual(operations.rows, [
    { kind: "refund", n: 1 },
    { kind: "transfer", n: 1 },
  ]);
});

test("an out-of-app transfer freezes release without erasing the verified paid history", async () => {
  const host = await hostFixture();
  const { booking, attempt } = await historicalPaidBooking(host.host);
  await completePaid(booking);
  await server(() =>
    rpc("pay_sync_transfer", [
      "sandbox",
      token("tr"),
      0,
      null,
      8500,
      attempt.charge,
      host.accountId,
    ]),
  );
  const row = (
    await db.query("select state,quarantine_reason from private.payment_attempts where id=$1", [
      attempt.attempt_id,
    ])
  ).rows[0];
  assert.equal(row.state, "paid");
  assert.match(row.quarantine_reason, /External transfer/);
  await server(() => rejected(() => rpc("pay_prepare_release", [admin, booking, randomUUID()])));
});

test("nonfounder referral refunds use the captured policy, not the presence of founder enrollment", async () => {
  await enablePolicy({ restore_refunded_credit: true });
  const referred = await hostFixture();
  const qualifying = await historicalPaidBooking(referred.host);
  await completePaid(qualifying.booking);
  const referrer = await hostFixture();
  await member(admin, () => rpc("admin_grant_referral", [referrer.host, referred.host, "sandbox"]));
  const { booking, attempt } = await paidBooking(referrer.host);
  assert.equal(attempt.commission_cents, 0);
  await enablePolicy({ restore_refunded_credit: false });
  const refundId = randomUUID();
  await server(() =>
    rpc("pay_prepare_refund", [
      admin,
      booking,
      10000,
      "Synthetic referral booking refund",
      refundId,
      attempt.attempt_id,
    ]),
  );
  await server(() => rpc("pay_record_operation", [refundId, token("re"), "succeeded", null]));
  assert.equal(
    (
      await db.query("select state from private.incentive_reservations where attempt_id=$1", [
        attempt.attempt_id,
      ])
    ).rows[0].state,
    "released",
  );
  await enablePolicy();
});

test("custom founding limits reserve the final credit, release failures, and freeze each enrollment", async () => {
  await enablePolicy({ founder_free_bookings: 2, founder_duration_months: 3 });
  const host = await hostFixture({ founder: true });
  const first = await paidBooking(host.host);
  assert.equal(first.attempt.commission_cents, 0);
  const last = await attach(await reserve(await acceptedBooking(host.host)));
  const waiting = await acceptedBooking(host.host);
  await rejected(() => reserve(waiting));
  await apply(last, { state: "failed" });
  const retry = await attach(await reserve(waiting));
  assert.equal(retry.commission_cents, 0);
  await apply(retry);
  assert.equal((await reserve(await acceptedBooking(host.host))).commission_cents, 1000);
  await enablePolicy({
    founder_free_bookings: 1,
    founder_duration_months: 1,
    founder_fee_bps: 500,
  });
  const snapshot = await server(() => value("pay_read_host", [host.host, "sandbox"]));
  assert.equal(snapshot.commercial.founder_free_bookings, 1);
  assert.equal(snapshot.commercial.founder.free_booking_limit, 2);
  assert.equal(snapshot.commercial.founder.duration_months, 3);
  assert.equal(snapshot.commercial.founder.lifetime_fee_bps, 1000);
  await member(admin, () =>
    rejected(() => enrollFounder(host.host, new Date().toISOString()), "23505"),
  );
  const nextHost = await hostFixture({ founder: true });
  const newSnapshot = await server(() => value("pay_read_host", [nextHost.host, "sandbox"]));
  assert.equal(newSnapshot.commercial.founder.free_booking_limit, 1);
  assert.equal(newSnapshot.commercial.founder.duration_months, 1);
  await enablePolicy();
});

test("custom calendar duration handles month ends/DST and checkout remains frozen across cutoff and policy changes", async () => {
  await enablePolicy({ founder_free_bookings: 2, founder_duration_months: 1 });
  const calendar = await hostFixture({ founder: true, startedAt: "2026-01-31T17:00:00.000Z" });
  let terms = (
    await db.query("select ends_at from private.host_incentive_terms where host_id=$1", [
      calendar.host,
    ])
  ).rows[0];
  assert.equal(new Date(terms.ends_at).toISOString(), "2026-02-28T17:00:00.000Z");
  const dst = await hostFixture({ founder: true, startedAt: "2026-02-15T17:00:00.000Z" });
  terms = (
    await db.query("select ends_at from private.host_incentive_terms where host_id=$1", [dst.host])
  ).rows[0];
  assert.equal(new Date(terms.ends_at).toISOString(), "2026-03-15T16:00:00.000Z");
  const startedAt = (
    await db.query(
      "select (((now() at time zone 'America/New_York') - interval '1 month' + interval '2 minutes') at time zone 'America/New_York') as value",
    )
  ).rows[0].value;
  const host = await hostFixture({ founder: true, startedAt });
  const booking = await acceptedBooking(host.host);
  const quoted = await attach(await reserve(booking));
  await db.query(
    "update private.host_incentive_terms set ends_at=now()-interval '1 second' where host_id=$1",
    [host.host],
  );
  await enablePolicy({
    founder_free_bookings: 0,
    founder_duration_months: 2,
    founder_fee_bps: 500,
  });
  const reused = await reserve(booking);
  assert.equal(reused.attempt_id, quoted.attempt_id);
  assert.equal(reused.policy_version, quoted.policy_version);
  assert.equal(reused.commission_cents, 0);
  await apply(quoted);
  assert.equal((await reserve(await acceptedBooking(host.host))).commission_cents, 1000);
  const noCredits = await hostFixture({ founder: true });
  assert.equal((await reserve(await acceptedBooking(noCredits.host))).commission_cents, 500);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from private.incentive_reservations where host_id=$1",
        [noCredits.host],
      )
    ).rows[0].n,
    0,
  );
  await enablePolicy();
});

test("custom founding refunds restore only a full refund when the enrolled policy allows it", async () => {
  for (const restore of [true, false]) {
    await enablePolicy({
      founder_free_bookings: 1,
      founder_duration_months: 2,
      restore_refunded_credit: restore,
    });
    const host = await hostFixture({ founder: true });
    const { booking, attempt } = await paidBooking(host.host);
    await enablePolicy({
      founder_free_bookings: 8,
      founder_duration_months: 12,
      restore_refunded_credit: !restore,
    });
    for (const amount of [4000, 6000]) {
      const operation = randomUUID();
      await server(() =>
        value("pay_prepare_refund", [
          admin,
          booking,
          amount,
          "Synthetic refund",
          operation,
          attempt.attempt_id,
        ]),
      );
      await server(() => rpc("pay_record_operation", [operation, token("re"), "succeeded", null]));
      const state = (
        await db.query("select state from private.incentive_reservations where attempt_id=$1", [
          attempt.attempt_id,
        ])
      ).rows[0].state;
      assert.equal(state, amount === 6000 && restore ? "released" : "consumed");
    }
    assert.equal(
      (await reserve(await acceptedBooking(host.host))).commission_cents,
      restore ? 0 : 1000,
    );
  }
  await enablePolicy();
});

test("SQL rejects omitted, fractional and out-of-range founding terms without changing the saved policy", async () => {
  const before = (
    await db.query("select policy_id from private.commercial_settings where environment='sandbox'")
  ).rows[0].policy_id;
  for (const field of ["founder_free_bookings", "founder_duration_months", "founder_cohort_cap"]) {
    const missing = settings();
    delete missing[field];
    await member(admin, () =>
      rejected(() => rpc("admin_set_commercial_policy", [missing]), "22023"),
    );
    for (const input of [null, 1.5, "", "1.2"])
      await member(admin, () =>
        rejected(() => rpc("admin_set_commercial_policy", [settings({ [field]: input })]), "22023"),
      );
  }
  for (const patch of [
    { founder_free_bookings: 101 },
    { founder_cohort_cap: 0 },
    { founder_cohort_cap: 10001 },
    { founder_duration_months: 0 },
    { founder_duration_months: 25 },
  ])
    await member(admin, () =>
      rejected(() => rpc("admin_set_commercial_policy", [settings(patch)]), "23514"),
    );
  assert.equal(
    (
      await db.query(
        "select policy_id from private.commercial_settings where environment='sandbox'",
      )
    ).rows[0].policy_id,
    before,
  );
});

test("founding activation requires a published listing and cohort cap counts all policy versions", async () => {
  await enablePolicy();
  const unpublished = await hostFixture();
  await member(admin, () =>
    rejected(() => enrollFounder(unpublished.host, new Date().toISOString())),
  );
  const count = (
    await db.query(
      "select count(*)::int as n from private.host_incentive_terms where environment='sandbox'",
    )
  ).rows[0].n;
  await enablePolicy({
    founder_cohort_cap: count + 1,
    founder_free_bookings: 3,
    founder_duration_months: 3,
  });
  await publishListing(unpublished.host);
  const agreed = "2026-01-20T17:00:00.000Z";
  await member(admin, () => enrollFounder(unpublished.host, agreed));
  const enrolled = (
    await db.query(
      "select starts_at,free_booking_limit from private.host_incentive_terms where host_id=$1",
      [unpublished.host],
    )
  ).rows[0];
  assert.equal(new Date(enrolled.starts_at).toISOString(), agreed);
  assert.equal(enrolled.free_booking_limit, 3);
  const overflow = await hostFixture();
  await publishListing(overflow.host);
  await enablePolicy({ founder_cohort_cap: count + 1, founder_free_bookings: 1 });
  await member(admin, () => rejected(() => enrollFounder(overflow.host, new Date().toISOString())));
  // Lowering a later cap preserves admitted hosts and still denies new admissions.
  await enablePolicy({ founder_cohort_cap: 1 });
  await member(admin, () => rejected(() => enrollFounder(overflow.host, new Date().toISOString())));
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from private.host_incentive_terms where environment='sandbox'",
      )
    ).rows[0].n,
    count + 1,
  );
  await enablePolicy();
});

test("founder enrollment rejects changed visible policy and accepts only reviewed current terms", async () => {
  const shownPolicy = await enablePolicy({ founder_free_bookings: 3, founder_duration_months: 3 });
  const host = await hostFixture();
  await publishListing(host.host);
  const agreed = new Date().toISOString();
  const replacement = await enablePolicy({
    founder_free_bookings: 1,
    founder_duration_months: 1,
    founder_fee_bps: 1250,
  });
  await member(admin, () => rejected(() => enrollFounder(host.host, agreed, shownPolicy), "22023"));
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from private.host_incentive_terms where host_id=$1",
        [host.host],
      )
    ).rows[0].n,
    0,
  );
  await member(admin, () =>
    rejected(() => rpc("admin_enroll_founder", [host.host, "sandbox", agreed, null]), "22023"),
  );
  // Old clients cannot fall back to enrollment without a reviewed policy ID.
  await member(admin, () =>
    rejected(() => rpc("admin_enroll_founder", [host.host, "sandbox", agreed]), "42883"),
  );
  await member(admin, () => enrollFounder(host.host, agreed, replacement));
  const enrolled = (
    await db.query(
      "select policy_id,free_booking_limit,duration_months,lifetime_fee_bps from private.host_incentive_terms where host_id=$1",
      [host.host],
    )
  ).rows[0];
  assert.deepEqual(enrolled, {
    policy_id: replacement,
    free_booking_limit: 1,
    duration_months: 1,
    lifetime_fee_bps: 1250,
  });
  await enablePolicy();
});

test("approved launch offer applies 17.5% standard, three free bookings or three months, then 12.5% for the founding cohort", async () => {
  // Exercise the exact approved launch economics alongside the configurable legacy
  // policies above. These are synthetic payments against isolated PostgreSQL only.
  await enablePolicy({
    standard_fee_bps: 1750,
    founder_fee_bps: 1250,
    founder_free_bookings: 3,
    founder_duration_months: 3,
    founder_cohort_cap: 30,
    processing_allocation: "host_actual_cost",
    payout_delay_hours: 48,
    referral_credit_cap: 2,
  });
  try {
    const standard = await hostFixture();
    assert.equal((await reserve(await acceptedBooking(standard.host))).commission_cents, 1750);

    const founder = await hostFixture({ founder: true });
    const enrollment = (
      await db.query(
        `select free_booking_limit,duration_months,lifetime_fee_bps,ends_at,
        ((starts_at at time zone 'America/New_York')+interval '3 months')
          at time zone 'America/New_York' as expected_end
        from private.host_incentive_terms where host_id=$1`,
        [founder.host],
      )
    ).rows[0];
    assert.equal(enrollment.free_booking_limit, 3);
    assert.equal(enrollment.duration_months, 3);
    assert.equal(enrollment.lifetime_fee_bps, 1250);
    assert.equal(enrollment.ends_at.getTime(), enrollment.expected_end.getTime());
    for (let i = 0; i < 2; i++)
      assert.equal((await paidBooking(founder.host)).attempt.commission_cents, 0);

    const third = await attach(await reserve(await acceptedBooking(founder.host)));
    assert.equal(third.commission_cents, 0);
    const waiting = await acceptedBooking(founder.host);
    await rejected(() => reserve(waiting));
    // A terminal failure releases the final free credit; it cannot be promised to
    // two simultaneous open checkouts or consumed by the failed attempt.
    await apply(third, { state: "failed" });
    const replacement = await attach(await reserve(waiting));
    assert.equal(replacement.commission_cents, 0);
    await apply(replacement);
    assert.equal((await reserve(await acceptedBooking(founder.host))).commission_cents, 1250);
    assert.deepEqual(
      (
        await db.query(
          "select state,count(*)::int as n from private.incentive_reservations where host_id=$1 and kind='founder' group by state order by state",
          [founder.host],
        )
      ).rows,
      [
        { state: "consumed", n: 3 },
        { state: "released", n: 1 },
      ],
    );

    const endedAt = (
      await db.query(
        "select (((now() at time zone 'America/New_York')-interval '3 months 1 minute') at time zone 'America/New_York') as start",
      )
    ).rows[0].start;
    const expiredFounder = await hostFixture({ founder: true, startedAt: endedAt });
    assert.equal(
      (await reserve(await acceptedBooking(expiredFounder.host))).commission_cents,
      1250,
    );
    // Later platform rate changes do not rewrite the enrolled cohort's rate.
    await enablePolicy({ founder_fee_bps: 1500 });
    assert.equal((await reserve(await acceptedBooking(founder.host))).commission_cents, 1250);
  } finally {
    await enablePolicy();
  }
});
