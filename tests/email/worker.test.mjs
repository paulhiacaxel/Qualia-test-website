import assert from "node:assert/strict";
import { test } from "node:test";
import { runEmailBatch } from "../../lib/email/worker.ts";

function harness(options = {}) {
  const calls = [],
    deliveries = [];
  let reads = 0;
  const context = {
    id: "job-id",
    booking_id: "booking-id",
    recipient_id: "owned-user-id",
    kind: "reminder_24h",
    title: "Lesson",
    starts_at: "2026-12-01T17:00:00Z",
    provider_payload: options.frozen ?? null,
  };
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === "email_claim_jobs")
        return {
          data: [
            { id: "job-id", lease_token: "lease", recipient_id: "owned-user-id", attempts: 1 },
          ],
        };
      if (name === "email_job_context") {
        reads++;
        return { data: options.cancelBeforeSend && reads > 1 ? null : context };
      }
      if (name === "email_prepare_send") return { data: args.p_payload };
      if (name === "email_finish_job") return { data: true };
      throw new Error(name);
    },
    auth: {
      admin: {
        getUserById: async (id) => {
          assert.equal(id, "owned-user-id");
          return {
            data: {
              user: {
                email: "verified@example.test",
                email_confirmed_at: options.unverified ? null : "2026-01-01",
                is_anonymous: false,
              },
            },
          };
        },
      },
    },
  };
  return {
    calls,
    deliveries,
    run: () =>
      runEmailBatch({
        client,
        from: "Qualia <bookings@example.test>",
        render: () => ({ subject: "Lesson", html: "<p>Lesson</p>", text: "Lesson" }),
        send: async (payload, key) => {
          deliveries.push({ payload, key });
          return options.sendResult ?? { accepted: true, id: "provider-id" };
        },
      }),
  };
}
test("worker resolves Auth-owned recipient and persists provider acceptance", async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.accepted, 1);
  assert.equal(h.deliveries[0].payload.to[0], "verified@example.test");
  assert.equal(h.deliveries[0].key, "qualia-booking/job-id");
  assert.equal(h.calls.at(-1)[1].p_outcome, "accepted");
});
test("cancellation after claim but before provider preflight prevents reminder", async () => {
  const h = harness({ cancelBeforeSend: true });
  const result = await h.run();
  assert.equal(h.deliveries.length, 0);
  assert.equal(result.skipped, 1);
});
test("unverified recipient never sends; changed email never redirects an existing idempotent payload", async () => {
  for (const options of [
    { unverified: true },
    {
      frozen: {
        to: ["old@example.test"],
        from: "frozen",
        subject: "old",
        html: "old",
        text: "old",
      },
    },
  ]) {
    const h = harness(options);
    await h.run();
    assert.equal(h.deliveries.length, 0);
    assert.equal(h.calls.at(-1)[1].p_outcome, "skipped");
  }
});
test("retry sends the stored payload unchanged after a deploy/configuration change", async () => {
  const frozen = {
    to: ["verified@example.test"],
    from: "old@example.test",
    subject: "Old subject",
    html: "Old HTML",
    text: "Old text",
  };
  const h = harness({
    frozen,
    sendResult: { accepted: false, retryable: true, code: "provider_http_429" },
  });
  await h.run();
  assert.deepEqual(h.deliveries[0].payload, frozen);
  assert.equal(h.calls.at(-1)[1].p_outcome, "retry");
});
