/** Execute the exact one-time launch script only in isolated PostgreSQL.
 * No hosted service, provider account, real acceptance or listing is changed.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeEach, afterEach, test } from "node:test";
import { createTestDatabase } from "../database/helpers.mjs";

const script = await readFile(
  new URL("../../scripts/activate-live-commercial-2026-10-13.sql", import.meta.url),
  "utf8",
);
let db;
let operator;
beforeEach(async () => {
  db = await createTestDatabase();
  operator = randomUUID();
  // Auth email exists in Supabase; this extra field belongs only to this fixture.
  await db.exec("alter table auth.users add column email text");
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'axel@bookqualia.com',now())",
    [operator],
  );
  await db.query(
    "insert into private.admin_memberships(user_id,reason) values($1,'Synthetic owner operator for local launch-script verification')",
    [operator],
  );
  await db.query(
    "insert into private.stripe_accounts(host_id,environment,account_id) values($1,'live','acct_1UPrcuRWrbZzYTAS')",
    [operator],
  );
  await db.query(
    `insert into private.booking_policy(singleton,request_expiry_minutes,payment_deadline_minutes,enabled,approved_by,approved_at)
    values(true,1440,1440,false,$1,'2026-10-12T00:00:00Z')`,
    [operator],
  );
});
afterEach(async () => db?.close());

async function snapshot() {
  return (
    await db.query(`select jsonb_build_object(
      'commercial_policies',(select coalesce(jsonb_agg(p order by p.id),'[]') from private.commercial_policies p),
      'commercial_settings',(select coalesce(jsonb_agg(s order by s.environment),'[]') from private.commercial_settings s),
      'booking_policy',(select to_jsonb(b) from private.booking_policy b),
      'booking_history',(select coalesce(jsonb_agg(h order by h.id),'[]') from private.booking_policy_history h),
      'acceptances',(select count(*) from private.legal_acceptances),
      'founders',(select count(*) from private.host_incentive_terms),
      'listings',(select count(*) from public.listings),
      'bookings',(select count(*) from public.bookings)) as value`)
  ).rows[0].value;
}
async function failsAtomically(message) {
  const before = await snapshot();
  await assert.rejects(() => db.exec(script), message);
  await db.exec("rollback");
  assert.deepEqual(await snapshot(), before);
}

test("launch script records exact approved live policy, deadlines and one operator audit event without fabricating consent", async () => {
  await db.exec(script);
  const actual = await snapshot();
  assert.equal(actual.commercial_policies.length, 1);
  const policy = actual.commercial_policies[0];
  assert.deepEqual(
    Object.fromEntries(
      [
        "environment",
        "standard_fee_bps",
        "founder_fee_bps",
        "founder_free_bookings",
        "founder_duration_months",
        "founder_cohort_cap",
        "processing_allocation",
        "payout_delay_hours",
        "restore_refunded_credit",
        "referral_free_bookings",
        "referral_credit_cap",
        "terms_version",
        "approved_by",
      ].map((key) => [key, policy[key]]),
    ),
    {
      environment: "live",
      standard_fee_bps: 1750,
      founder_fee_bps: 1250,
      founder_free_bookings: 3,
      founder_duration_months: 3,
      founder_cohort_cap: 40,
      processing_allocation: "host_actual_cost",
      payout_delay_hours: 48,
      restore_refunded_credit: true,
      referral_free_bookings: 1,
      referral_credit_cap: 2,
      terms_version: "qualia_host_2026_10_13_v1",
      approved_by: operator,
    },
  );
  assert.match(
    policy.cancellation_terms,
    /Guest cancellation at least 48 hours before start: full refund/,
  );
  assert.match(policy.cancellation_terms, /Host cancellation: full refund/);
  assert.match(policy.cancellation_terms, /less than 48 hours before start: no automatic refund/);
  assert.match(
    policy.cancellation_terms,
    /https:\/\/bookqualia.com\/legal\/qualia_cancellation_2026_10_13_v1$/,
  );
  assert.deepEqual(actual.commercial_settings, [
    { environment: "live", policy_id: policy.id, enabled: true },
  ]);
  assert.equal(actual.booking_policy.enabled, true);
  assert.equal(actual.booking_policy.request_expiry_minutes, 1440);
  assert.equal(actual.booking_policy.payment_deadline_minutes, 1440);
  assert.equal(actual.booking_policy.approved_by, operator);
  assert.equal(actual.booking_history.length, 1);
  assert.equal(actual.booking_history[0].actor_id, operator);
  assert.equal(actual.booking_history[0].settings.commercial_policy_id, policy.id);
  assert.match(
    actual.booking_history[0].settings.authorization_source,
    /Owner-approved live launch/,
  );
  assert.deepEqual(
    [actual.acceptances, actual.founders, actual.listings, actual.bookings],
    [0, 0, 0, 0],
  );
});

test("re-running successful launch configuration is an exact no-op including timestamps and audit history", async () => {
  await db.exec(script);
  const before = await snapshot();
  await db.exec(script);
  assert.deepEqual(await snapshot(), before);
});

test("a later paused commercial policy cannot be silently re-enabled", async () => {
  await db.exec(script);
  await db.exec("update private.commercial_settings set enabled=false where environment='live'");
  await failsAtomically(/paused or inconsistent/);
});

test("a later paused booking policy cannot be silently re-enabled", async () => {
  await db.exec(script);
  await db.exec("update private.booking_policy set enabled=false where singleton");
  await failsAtomically(/paused or inconsistent/);
});

test("wrong or rehearsal Stripe target fails before any launch state changes", async () => {
  await db.exec("update private.stripe_accounts set account_id='acct_synthetic_wrong'");
  await failsAtomically(/Expected production live Stripe mapping is missing/);
  await db.exec(
    "update private.stripe_accounts set account_id='acct_1UPrcuRWrbZzYTAS',environment='sandbox'",
  );
  await failsAtomically(/Expected production live Stripe mapping is missing/);
});

test("changed request or payment deadlines fail atomically instead of selecting replacement terms", async () => {
  await db.exec("update private.booking_policy set request_expiry_minutes=120 where singleton");
  await failsAtomically(/Booking deadlines changed/);
  await db.exec(
    "update private.booking_policy set request_expiry_minutes=1440,payment_deadline_minutes=120 where singleton",
  );
  await failsAtomically(/Booking deadlines changed/);
});

test("unverified or non-admin owner identities cannot authorize launch", async () => {
  await db.exec("update auth.users set email_confirmed_at=null");
  await failsAtomically(/query returned no rows/);
  await db.exec("update auth.users set email_confirmed_at=now()");
  await db.exec("delete from private.admin_memberships");
  await failsAtomically(/query returned no rows/);
});
