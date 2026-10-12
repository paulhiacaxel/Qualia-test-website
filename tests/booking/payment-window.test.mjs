import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutWindow, hostCanAcceptPaymentWindow } from "../../lib/booking/payment-window.ts";

const now = Date.parse("2026-10-12T16:00:00Z");
const at = (minutes) => new Date(now + minutes * 60_000).toISOString();
const fresh = {
  booking_status: "awaiting_payment",
  starts_at: at(120),
  payment_deadline_at: at(32),
  checkout_state: null,
  checkout_session_exists: false,
  checkout_expires_at: null,
};

test("new Checkout has a separate opening cutoff before the payment-completion deadline", () => {
  assert.deepEqual(checkoutWindow(fresh, now), { mode: "new", openBy: at(1), payBy: at(32) });
  assert.equal(checkoutWindow(fresh, now + 60_000 - 1).mode, "new");
  assert.equal(checkoutWindow(fresh, now + 60_000).mode, "closed");
  assert.equal(checkoutWindow({ ...fresh, starts_at: at(31) }, now).mode, "closed");
  assert.equal(checkoutWindow({ ...fresh, payment_deadline_at: null }, now).mode, "closed");
  assert.equal(checkoutWindow({ ...fresh, booking_status: "cancelled" }, now).mode, "closed");
});

test("an existing open checkout resumes near its expiry without opening a second session", () => {
  const open = {
    ...fresh,
    checkout_state: "open",
    checkout_session_exists: true,
    checkout_expires_at: at(2),
  };
  assert.equal(checkoutWindow(open, now).mode, "resume");
  assert.equal(checkoutWindow(open, now + 120_000 - 1).mode, "resume");
  assert.equal(checkoutWindow(open, now + 120_000).mode, "reconciling");
  for (const checkout_state of ["processing", "paid", "quarantined"])
    assert.equal(
      checkoutWindow({ ...open, checkout_state, checkout_expires_at: at(-1) }, now).mode,
      "reconciling",
    );
});

test("a prepared attempt without a session keeps its hold after the creation cutoff", () => {
  assert.equal(
    checkoutWindow(
      {
        ...fresh,
        payment_deadline_at: at(120),
        checkout_state: "preparing",
        checkout_expires_at: at(30),
      },
      now,
    ).mode,
    "reconciling",
  );
});

test("host acceptance needs a valid captured policy and more than 32 minutes until start", () => {
  assert.equal(hostCanAcceptPaymentWindow(at(32), 32, now), false);
  assert.equal(
    hostCanAcceptPaymentWindow(new Date(now + 32 * 60_000 + 1).toISOString(), 32, now),
    true,
  );
  for (const minutes of [null, undefined, 1, 30, 31])
    assert.equal(hostCanAcceptPaymentWindow(at(120), minutes, now), false);
});
