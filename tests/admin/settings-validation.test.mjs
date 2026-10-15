import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingPolicyInputSchema } from "../../lib/admin/settings-validation.ts";

test("booking settings stay unconfigured until the owner chooses deadlines and enables requests", () => {
  const blank = { enabled: false, requestExpiryMinutes: "", paymentDeadlineMinutes: "" };
  assert.deepEqual(bookingPolicyInputSchema.parse(blank), {
    enabled: false,
    requestExpiryMinutes: null,
    paymentDeadlineMinutes: null,
  });
  assert.equal(bookingPolicyInputSchema.safeParse({ ...blank, enabled: true }).success, false);
  assert.equal(
    bookingPolicyInputSchema.safeParse({ ...blank, enabled: true, requestExpiryMinutes: "60" })
      .success,
    false,
  );
  assert.deepEqual(
    bookingPolicyInputSchema.parse({
      enabled: true,
      requestExpiryMinutes: "60",
      paymentDeadlineMinutes: "120",
    }),
    { enabled: true, requestExpiryMinutes: 60, paymentDeadlineMinutes: 120 },
  );
});

test("booking deadline settings reject fractional, negative, zero, malformed, and oversized input", () => {
  for (const minutes of ["0", "-1", "1.5", "10081", "later", "Infinity", {}, true]) {
    assert.equal(
      bookingPolicyInputSchema.safeParse({
        enabled: false,
        requestExpiryMinutes: minutes,
        paymentDeadlineMinutes: "60",
      }).success,
      false,
    );
  }
  assert.equal(
    bookingPolicyInputSchema.safeParse({
      enabled: false,
      requestExpiryMinutes: "1",
      paymentDeadlineMinutes: "10080",
    }).success,
    true,
  );
});

test("new payment windows need 32 minutes while response windows may be shorter", () => {
  for (const payment of ["1", "30", "31"]) {
    assert.equal(
      bookingPolicyInputSchema.safeParse({
        enabled: true,
        requestExpiryMinutes: "1",
        paymentDeadlineMinutes: payment,
      }).success,
      false,
    );
  }
  assert.equal(
    bookingPolicyInputSchema.safeParse({
      enabled: true,
      requestExpiryMinutes: "1",
      paymentDeadlineMinutes: "32",
    }).success,
    true,
  );
});
