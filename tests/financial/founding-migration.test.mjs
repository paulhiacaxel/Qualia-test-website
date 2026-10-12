import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createTestDatabase } from "../database/helpers.mjs";
import { foundingOfferSummary } from "../../lib/payments/incentives.ts";

test("upgrade preserves legacy enrollment dates, rates, refund rule and ten/six offer without enabling payments", async () => {
  const host = randomUUID();
  const policy = randomUUID();
  let before;
  const db = await createTestDatabase({
    beforeMigration: async (connection, name) => {
      if (!name.endsWith("_configurable_founding_incentives.sql")) return;
      await connection.query("insert into auth.users(id,email_confirmed_at) values($1,now())", [
        host,
      ]);
      await connection.query(
        `insert into private.commercial_policies(id,environment,standard_fee_bps,founder_fee_bps,processing_allocation,payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,terms_version,cancellation_terms,approved_by)
      values($1,'sandbox',1750,1000,'platform_absorbs',48,false,1,10,'legacy-test','Synthetic legacy cancellation terms',$2)`,
        [policy, host],
      );
      await connection.query(
        `insert into private.host_incentive_terms(host_id,environment,policy_id,lifetime_fee_bps,starts_at,ends_at,restore_refunded_credit,approved_by)
      values($1,'sandbox',$2,1000,'2026-01-15 17:00+00','2026-07-15 16:00+00',false,$1)`,
        [host, policy],
      );
      before = (
        await connection.query("select * from private.host_incentive_terms where host_id=$1", [
          host,
        ])
      ).rows[0];
    },
  });
  try {
    const after = (
      await db.query("select * from private.host_incentive_terms where host_id=$1", [host])
    ).rows[0];
    assert.deepEqual(after, { ...before, free_booking_limit: 10, duration_months: 6 });
    const terms = (
      await db.query(
        "select founder_free_bookings,founder_duration_months,founder_cohort_cap from private.commercial_policies where id=$1",
        [policy],
      )
    ).rows[0];
    assert.deepEqual(terms, {
      founder_free_bookings: 10,
      founder_duration_months: 6,
      founder_cohort_cap: null,
    });
    assert.equal(
      (await db.query("select count(*)::int as n from private.commercial_settings")).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("offer copy reflects saved terms and distinguishes waived commission from free experiences", () => {
  const copy = foundingOfferSummary({ freeBookings: 3, durationMonths: 2, lifetimeFeeBps: 1000 });
  assert.match(copy, /0% commission on your first 3 paid bookings or 2 calendar months/);
  assert.match(copy, /then 10\.00% for life/);
  assert.doesNotMatch(copy, /ten|six|free bookings/);
  assert.match(
    foundingOfferSummary({ freeBookings: 1, durationMonths: 1, lifetimeFeeBps: 725 }),
    /1 paid booking or 1 calendar month.*7\.25%/,
  );
  assert.match(
    foundingOfferSummary({ freeBookings: 0, durationMonths: 6, lifetimeFeeBps: 1000 }),
    /no commission-free bookings/,
  );
});
