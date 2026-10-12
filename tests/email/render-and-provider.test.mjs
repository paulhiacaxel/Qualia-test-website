import assert from "node:assert/strict";
import { test } from "node:test";
import { renderBookingEmail } from "../../lib/email/render.ts";
import { sendWithResend } from "../../lib/email/resend.ts";
import { isEmailJobAuthorized } from "../../lib/email/job-auth.ts";
const context = {
  id: "11111111-1111-1111-1111-111111111111",
  booking_id: "22222222-2222-2222-2222-222222222222",
  recipient_id: "33333333-3333-3333-3333-333333333333",
  kind: "accepted",
  title: '<img src=x onerror="alert(1)"> & painting',
  starts_at: "2026-12-01T17:00:00Z",
  payment_deadline_at: "2026-11-28T18:00:00Z",
  provider_payload: null,
  first_send_at: null,
};
const payload = {
  from: "Qualia <bookings@example.test>",
  to: ["guest@example.test"],
  ...renderBookingEmail(context, "https://qualia.example"),
};

test("templates escape user titles, link to configured origin and do not claim payment before confirmation", () => {
  assert.ok(payload.html.includes("&lt;img"));
  assert.ok(!payload.html.includes("<img src=x"));
  assert.ok(
    payload.html.includes("https://qualia.example/bookings/22222222-2222-2222-2222-222222222222"),
  );
  assert.ok(payload.text.includes("confirmed only after payment"));
  assert.ok(payload.text.includes("Miami time"));
  for (const kind of [
    "new_request",
    "accepted",
    "confirmed",
    "cancelled",
    "request_closed",
    "reminder_24h",
  ]) {
    const result = renderBookingEmail(
      { ...context, kind, address_line1: "SECRET ADDRESS", guest_message: "SECRET NOTE" },
      "https://qualia.example",
    );
    assert.ok(!result.html.includes("SECRET"));
    assert.ok(!result.text.includes("SECRET"));
  }
  assert.throws(() => renderBookingEmail(context, "javascript:alert(1)"));
  assert.throws(() =>
    renderBookingEmail({ ...context, booking_id: '../admin"' }, "https://qualia.example"),
  );
});

test("job authorization fails closed and requires exact bearer secret", () => {
  const secret = "a".repeat(32);
  assert.equal(isEmailJobAuthorized(`Bearer ${secret}`, secret), true);
  for (const [header, value] of [
    [null, secret],
    [`Bearer ${secret}`, undefined],
    [`Bearer ${secret}x`, secret],
    ["Bearer short", "short"],
  ])
    assert.equal(isEmailJobAuthorized(header, value), false);
});

test("acceptance email separates the opening cutoff from completion and preserves resume guidance", () => {
  const result = renderBookingEmail(context, "https://qualia.example");
  for (const content of [result.text, result.html]) {
    assert.match(content, /Start a new checkout before Saturday, November 28, 2026 at 12:29 PM/);
    assert.match(content, /Complete payment by Saturday, November 28, 2026 at 1:00 PM/);
    assert.match(content, /already opened checkout, return to your booking to resume it/);
  }
  const startLimited = renderBookingEmail(
    {
      ...context,
      starts_at: "2026-12-01T17:00:00Z",
      payment_deadline_at: "2026-12-01T18:00:00Z",
    },
    "https://qualia.example",
  );
  assert.match(
    startLimited.text,
    /Start a new checkout before Tuesday, December 1, 2026 at 11:29 AM/,
  );
  assert.match(startLimited.text, /Complete payment by Tuesday, December 1, 2026 at 12:00 PM/);
  const confirmed = renderBookingEmail({ ...context, kind: "confirmed" }, "https://qualia.example");
  assert.ok(!confirmed.text.includes("Start a new checkout"));
});

test("Resend uses fixed API origin, frozen payload and idempotency header, returning acceptance only", async () => {
  const sent = [];
  const fakeFetch = async (url, init) => {
    sent.push({ url, init });
    return new Response(JSON.stringify({ id: "email_provider_id" }), { status: 200 });
  };
  const result = await sendWithResend(payload, "qualia-booking/test", "test-key", fakeFetch);
  assert.deepEqual(result, { accepted: true, id: "email_provider_id" });
  assert.equal(sent[0].url, "https://api.resend.com/emails");
  assert.equal(sent[0].init.headers["Idempotency-Key"], "qualia-booking/test");
  assert.deepEqual(JSON.parse(sent[0].init.body), payload);
  assert.ok(!("delivered" in result));
});

test("transient failures retry; validation and payload conflicts fail; unknown acceptance stays retryable", async () => {
  for (const [status, data, retryable] of [
    [429, {}, true],
    [500, {}, true],
    [403, {}, false],
    [422, {}, false],
    [409, { name: "concurrent_idempotent_requests" }, true],
    [409, { name: "invalid_idempotent_request" }, false],
    [200, {}, true],
  ]) {
    const result = await sendWithResend(
      payload,
      "key",
      "test-key",
      async () => new Response(JSON.stringify(data), { status }),
    );
    assert.equal(result.accepted, false);
    assert.equal(result.retryable, retryable);
  }
  assert.deepEqual(
    await sendWithResend(payload, "key", "test-key", async () => {
      throw new Error("contains personal data");
    }),
    { accepted: false, retryable: true, code: "provider_network_or_timeout" },
  );
});
