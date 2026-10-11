import assert from "node:assert/strict";
import { test } from "node:test";
import { commercialInputSchema } from "../../lib/admin/commercial-validation.ts";

const proposed = {
  environment: "sandbox",
  enabled: false,
  standard_fee_bps: "15.25",
  founder_fee_bps: "10",
  processing_allocation: "platform_absorbs",
  payout_delay_hours: "48",
  restore_refunded_credit: "no",
  referral_free_bookings: "2",
  referral_credit_cap: "6",
  terms_version: "sandbox-test-only",
  cancellation_terms: "This is a test fixture, not a launch policy.",
  incentive_start: "host_enrollment",
  cutoff_rule: "checkout_before_cutoff_frozen_quote",
  refund_rule: "proportional_commission_nonrefundable_processing",
  completion_rule: "admin_after_end",
  liability_acknowledged: true,
};

test("commercial choices are explicit and percentages become exact integer basis points", () => {
  const result = commercialInputSchema.parse(proposed);
  assert.equal(result.standard_fee_bps, 1525);
  assert.equal(result.founder_fee_bps, 1000);
  assert.equal(result.restore_refunded_credit, false);
  for (const key of Object.keys(proposed)) {
    const missing = { ...proposed };
    delete missing[key];
    assert.equal(commercialInputSchema.safeParse(missing).success, false, key);
  }
  for (const field of [
    "standard_fee_bps",
    "founder_fee_bps",
    "payout_delay_hours",
    "referral_free_bookings",
    "referral_credit_cap",
    "restore_refunded_credit",
  ])
    assert.equal(
      commercialInputSchema.safeParse({ ...proposed, [field]: "" }).success,
      false,
      field,
    );
});

test("commercial validation rejects invalid economics and unapproved liability", () => {
  for (const patch of [
    { standard_fee_bps: "100.01" },
    { standard_fee_bps: "1e2" },
    { founder_fee_bps: "16" },
    { referral_credit_cap: "1" },
    { payout_delay_hours: "1.5" },
    { liability_acknowledged: false },
    { refund_rule: "invented" },
    { environment: "production" },
    { restore_refunded_credit: "false" },
  ])
    assert.equal(commercialInputSchema.safeParse({ ...proposed, ...patch }).success, false);
  assert.equal(
    commercialInputSchema.safeParse({
      ...proposed,
      standard_fee_bps: "0",
      founder_fee_bps: "0",
      referral_free_bookings: "0",
      referral_credit_cap: "0",
    }).success,
    true,
  );
});
