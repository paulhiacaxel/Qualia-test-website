import assert from "node:assert/strict";
import { test } from "node:test";
import { diagnosticMessage, runEmailDiagnostic } from "../../lib/email/diagnostic.ts";

const owner = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "owner@example.test",
  email_confirmed_at: "2026-10-12T00:00:00Z",
  is_anonymous: false,
};
function fixture(overrides = {}) {
  const calls = [];
  const dependencies = {
    requireAdmin: async () => owner,
    from: "Qualia <support@example.test>",
    siteUrl: "https://qualia.example",
    now: new Date("2026-10-12T16:00:00Z"),
    send: async (payload, key) => {
      calls.push({ payload, key });
      return { accepted: true, id: "provider-test-id" };
    },
    ...overrides,
  };
  const form = new FormData();
  form.set("confirm", "on");
  return { calls, dependencies, form };
}

test("diagnostic sends only fixed copy to the server-verified admin, ignoring arbitrary form fields", async () => {
  const { calls, dependencies, form } = fixture();
  for (const field of ["to", "recipient", "from", "subject", "html", "text", "siteUrl", "id"])
    form.set(field, "injected@example.test");
  const result = await runEmailDiagnostic(form, dependencies);
  assert.deepEqual(result, { providerId: "provider-test-id" });
  assert.deepEqual(calls[0].payload, {
    from: dependencies.from,
    to: [owner.email],
    ...diagnosticMessage(dependencies.siteUrl),
  });
  assert.ok(!JSON.stringify(calls).includes("injected@example.test"));
  assert.match(calls[0].payload.text, /No booking was created and no payment was taken/);
  assert.ok(!("delivered" in result));
});

test("authorization failure, unverified recipients and absent approval never call the provider", async () => {
  const denied = fixture({
    requireAdmin: async () => {
      throw new Error("admin access denied");
    },
  });
  await assert.rejects(runEmailDiagnostic(denied.form, denied.dependencies), /admin access denied/);
  assert.equal(denied.calls.length, 0);
  for (const user of [
    { ...owner, email: undefined },
    { ...owner, email_confirmed_at: undefined },
    { ...owner, is_anonymous: true },
  ]) {
    const f = fixture({ requireAdmin: async () => user });
    assert.ok((await runEmailDiagnostic(f.form, f.dependencies)).error);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  f.form.delete("confirm");
  assert.ok((await runEmailDiagnostic(f.form, f.dependencies)).error);
  assert.equal(f.calls.length, 0);
});

test("same-admin same-UTC-day retries use one stable key and payload, with other admins isolated", async () => {
  const f = fixture();
  await runEmailDiagnostic(f.form, f.dependencies);
  await runEmailDiagnostic(f.form, {
    ...f.dependencies,
    now: new Date("2026-10-12T23:59:59Z"),
  });
  assert.deepEqual(f.calls[0], f.calls[1]);
  assert.equal(f.calls[0].key, `qualia-email-diagnostic/v1/${owner.id}/2026-10-12`);
  await runEmailDiagnostic(f.form, { ...f.dependencies, now: new Date("2026-10-13T00:00:00Z") });
  assert.notEqual(f.calls[0].key, f.calls[2].key);
  await runEmailDiagnostic(f.form, {
    ...f.dependencies,
    requireAdmin: async () => ({ ...owner, id: "22222222-2222-2222-2222-222222222222" }),
  });
  assert.notEqual(f.calls[0].key, f.calls[3].key);
});

test("missing configuration and unsafe origins fail without network calls", async () => {
  for (const override of [
    { from: undefined },
    { siteUrl: null },
    { send: undefined },
    { siteUrl: "javascript:alert(1)" },
    { siteUrl: "https://user:password@qualia.example" },
  ]) {
    const f = fixture(override);
    assert.ok((await runEmailDiagnostic(f.form, f.dependencies)).error);
    assert.equal(f.calls.length, 0);
  }
});

test("provider failure exposes controlled guidance, never internal error details or delivery claims", async () => {
  for (const retryable of [true, false]) {
    const f = fixture({
      send: async () => ({ accepted: false, retryable, code: "SECRET_PROVIDER_DETAIL" }),
    });
    const result = await runEmailDiagnostic(f.form, f.dependencies);
    assert.ok(result.error);
    assert.ok(!JSON.stringify(result).includes("SECRET_PROVIDER_DETAIL"));
    assert.equal(result.providerId, undefined);
  }
  const f = fixture({
    send: async () => {
      throw new Error("SECRET_KEY");
    },
  });
  const result = await runEmailDiagnostic(f.form, f.dependencies);
  assert.ok(result.error);
  assert.ok(!JSON.stringify(result).includes("SECRET_KEY"));
});
