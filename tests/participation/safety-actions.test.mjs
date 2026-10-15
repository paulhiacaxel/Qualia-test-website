import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";

const control = {
  authError: null,
  events: [],
  result: { data: 1, error: null },
};
globalThis.__qualiaSafetyActionTest = control;
const stub = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const auth = stub(`
  async function check(role) {
    const state = globalThis.__qualiaSafetyActionTest;
    state.events.push({ auth: role });
    if (state.authError) throw state.authError;
  }
  export const requireAdultHost = () => check('host');
  export const requireAdmin = () => check('admin');
`);
const database = stub(`
  export async function createClient() {
    return { rpc: async (name, args) => {
      const state = globalThis.__qualiaSafetyActionTest;
      state.events.push({ rpc: name, args });
      return state.result;
    }};
  }
`);
const cache = stub(`
  export function revalidatePath(path) {
    globalThis.__qualiaSafetyActionTest.events.push({ revalidate: path });
  }
`);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      "@/lib/auth/session": auth,
      "@/lib/supabase/server": database,
      "next/cache": cache,
    };
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith("@/"))
      return nextResolve(new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { saveListingSafety } = await import("../../app/host/safety-actions.ts");
const { reviewListingSafety } = await import("../../app/admin/safety-actions.ts");
const listingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function hostForm(overrides = {}) {
  const values = {
    listingId,
    expectedRevision: "",
    min_age: "",
    max_age: "",
    guardian_presence: "",
    participation_rules: "",
    hazards: "",
    equipment: "",
    prerequisites: "",
    supervision_plan: "",
    credentials_evidence: "",
    insurance_evidence: "",
    venue_evidence: "",
    emergency_plan: "",
    evidence_expires_on: "",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function reviewForm(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    listingId,
    expectedRevision: "3",
    decision: "approved",
    reviewNote: "Reviewed the supporting activity-specific evidence.",
    validUntil: "2027-07-15T18:00",
    ...overrides,
  }))
    data.set(key, value);
  return data;
}

beforeEach(() => {
  control.authError = null;
  control.events = [];
  control.result = { data: 1, error: null };
});

test("an incomplete host draft stays incomplete and cannot carry forged approval fields", async () => {
  const result = await saveListingSafety(
    {},
    hostForm({
      review_status: "approved",
      minor_without_guardian_approved: "true",
      reviewed_by: listingId,
    }),
  );
  assert.equal(result.savedRevision, 1);
  assert.ok(result.success);
  const call = control.events.find((event) => event.rpc);
  assert.equal(control.events[0].auth, "host");
  assert.equal(call.rpc, "save_listing_safety_submission");
  assert.equal(call.args.p_expected_revision, null);
  assert.equal(call.args.p_submission.min_age, null);
  assert.equal(call.args.p_submission.max_age, null);
  assert.equal(call.args.p_submission.guardian_presence, null);
  assert.equal(call.args.p_submission.evidence_expires_on, null);
  assert.equal("review_status" in call.args.p_submission, false);
  assert.equal("minor_without_guardian_approved" in call.args.p_submission, false);
  assert.equal("reviewed_by" in call.args.p_submission, false);
});

test("stale host saves preserve the last confirmed revision without claiming success", async () => {
  control.result = { data: null, error: { code: "40001", message: "A newer revision exists." } };
  const result = await saveListingSafety({ savedRevision: 4 }, hostForm({ expectedRevision: "4" }));
  assert.equal(result.savedRevision, 4);
  assert.equal(result.error, "A newer revision exists.");
  assert.equal(result.success, undefined);
  assert.equal(
    control.events.some((event) => event.revalidate),
    false,
  );
});

test("invalid host ranges and malformed revisions never reach the database", async () => {
  for (const fields of [
    { min_age: "18", max_age: "12" },
    { expectedRevision: "0" },
    { min_age: "1.5" },
  ]) {
    const result = await saveListingSafety({}, hostForm(fields));
    assert.ok(result.error);
  }
  assert.equal(
    control.events.some((event) => event.rpc),
    false,
  );
});

test("both safety actions require their role before any database mutation", async () => {
  control.authError = new Error("Unauthenticated");
  await assert.rejects(saveListingSafety({}, hostForm()), /Unauthenticated/);
  await assert.rejects(reviewListingSafety({}, reviewForm()), /Unauthenticated/);
  assert.deepEqual(
    control.events.map((event) => event.auth),
    ["host", "admin"],
  );
  assert.equal(
    control.events.some((event) => event.rpc),
    false,
  );
});

test("admin approval sends exact revision and Miami expiry without implying guardian exception", async () => {
  control.result = { data: null, error: null };
  const result = await reviewListingSafety({}, reviewForm());
  assert.ok(result.success);
  const call = control.events.find((event) => event.rpc);
  assert.equal(call.rpc, "admin_review_listing_safety");
  assert.equal(call.args.p_expected_revision, 3);
  assert.equal(call.args.p_valid_until, "2027-07-15T22:00:00Z");
  assert.equal(call.args.p_minor_without_guardian_approved, false);
});

test("admin approval requires expiry and rejects ambiguous Miami clock-change times", async () => {
  for (const validUntil of ["", "2026-11-01T01:30", "2027-03-14T02:30"]) {
    const result = await reviewListingSafety({}, reviewForm({ validUntil }));
    assert.ok(result.error);
  }
  assert.equal(
    control.events.some((event) => event.rpc),
    false,
  );
});

test("returning evidence for changes does not require a new approval expiry", async () => {
  control.result = { data: null, error: null };
  const result = await reviewListingSafety(
    {},
    reviewForm({ decision: "rejected", validUntil: "" }),
  );
  assert.ok(result.success);
  const call = control.events.find((event) => event.rpc);
  assert.equal(call.args.p_valid_until, null);
  assert.equal(call.args.p_minor_without_guardian_approved, false);
});
