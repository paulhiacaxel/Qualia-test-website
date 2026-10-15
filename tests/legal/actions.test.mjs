import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";

const control = { events: [], error: null, authError: null };
globalThis.__qualiaLegalTest = control;
const stub = (text) => `data:text/javascript,${encodeURIComponent(text)}`;
const auth = stub(
  `export async function requireUser() {const s=globalThis.__qualiaLegalTest;s.events.push({auth:true});if(s.authError)throw s.authError;}`,
);
const database = stub(
  `export async function createClient(){return {rpc:async(name,args)=>{const s=globalThis.__qualiaLegalTest;s.events.push({rpc:name,args});return {error:s.error};}}}`,
);
const navigation = stub(
  `export function redirect(path){throw Object.assign(new Error('redirect'),{redirect:path})}`,
);
const cache = stub(
  `export function revalidatePath(path){globalThis.__qualiaLegalTest.events.push({revalidate:path})}`,
);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      "@/lib/auth/session": auth,
      "@/lib/supabase/server": database,
      "next/navigation": navigation,
      "next/cache": cache,
    };
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith("@/"))
      return nextResolve(new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { acceptLegalTerms } = await import("../../app/account/agreements/actions.ts");
const { safeNext } = await import("../../lib/auth/validation.ts");
function form(overrides = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    scope: "guest",
    guestVersion: "qualia_guest_2026_10_13_v1",
    termsAccepted: "on",
    privacyAcknowledged: "on",
    next: "/discover",
    ...overrides,
  }))
    result.set(key, value);
  return result;
}
beforeEach(() => {
  control.events = [];
  control.error = null;
  control.authError = null;
});
test("missing agreement, notice or stale version never sends acceptance", async () => {
  for (const change of [
    { termsAccepted: "" },
    { privacyAcknowledged: "" },
    { guestVersion: "old" },
    { scope: "host" },
    { scope: "host", hostVersion: "qualia_host_2026_10_13_v1" },
    { scope: "admin" },
  ])
    assert.ok((await acceptLegalTerms({}, form(change))).error);
  assert.equal(
    control.events.some((e) => e.rpc),
    false,
  );
});
test("guest acceptance uses server versions and ignores forged actor/time fields", async () => {
  await assert.rejects(
    () =>
      acceptLegalTerms(
        {},
        form({ userId: "somebodyelse", acceptedAt: "2000-01-01", hostVersion: "forged" }),
      ),
    (e) => e.redirect === "/discover",
  );
  assert.equal(control.events[0].auth, true);
  assert.deepEqual(
    control.events.find((e) => e.rpc),
    {
      rpc: "accept_legal_terms",
      args: {
        p_scope: "guest",
        p_guest_version: "qualia_guest_2026_10_13_v1",
        p_host_version: null,
        p_terms_accepted: true,
        p_privacy_acknowledged: true,
      },
    },
  );
});
test("host acceptance uses the reviewed host version and safe navigation", async () => {
  await assert.rejects(
    () =>
      acceptLegalTerms(
        {},
        form({
          scope: "host",
          hostVersion: "qualia_host_2026_10_13_v2",
          next: "https://evil.example",
        }),
      ),
    (e) => e.redirect === "/account/dashboard",
  );
  assert.equal(control.events.find((e) => e.rpc).args.p_host_version, "qualia_host_2026_10_13_v2");
});
test("an RPC failure never reports acceptance or revalidates", async () => {
  control.error = { code: "42501" };
  assert.ok((await acceptLegalTerms({}, form())).error);
  assert.equal(
    control.events.some((e) => e.revalidate),
    false,
  );
});
test("agreements can retain only a safe destination with no nested redirects", () => {
  assert.equal(
    safeNext("/account/agreements?scope=host&next=%2Fhost%2Fstart"),
    "/account/agreements?scope=host&next=%2Fhost%2Fstart",
  );
  for (const next of [
    "/account/agreements?scope=host&next=https%3A%2F%2Fevil.example",
    "/account/agreements?scope=guest&next=%2Faccount%2Feligibility",
    "/account/eligibility?next=%2Faccount%2Fagreements",
    "/account/agreements?scope=guest&next=%2Fdiscover&scope=host",
  ])
    assert.equal(safeNext(next), "/account/dashboard");
});
