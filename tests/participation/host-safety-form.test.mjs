/** Exercise React's real form-action/reset behavior with a synthetic host draft.
 * The action is stubbed; no host account, network, or database is used here.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { after, afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import swc from "next/dist/build/swc/index.js";

const control = { calls: [], error: null };
globalThis.__qualiaSafetyFormTest = control;
const actionModule = `data:text/javascript,${encodeURIComponent(`
  export async function saveListingSafety(previous, formData) {
    const control = globalThis.__qualiaSafetyFormTest;
    const fields = Object.fromEntries(formData);
    control.calls.push(fields);
    if (control.error) return { error: control.error, savedRevision: previous.savedRevision };
    return { savedRevision: Number(fields.expectedRevision || 0) + 1, success: "Draft saved." };
  }
`)}`;

// Use the project's own JSX compiler, so these tests import the actual component.
await swc.loadBindings();
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/app/host/safety-actions") return { url: actionModule, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const path = new URL(`../../${specifier.slice(2)}`, import.meta.url);
      const extension = existsSync(new URL(`${path.href}.tsx`)) ? ".tsx" : ".ts";
      return nextResolve(`${path.href}${extension}`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) {
      const { code } = swc.transformSync(readFileSync(new URL(url), "utf8"), {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          target: "es2022",
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "es6" },
      });
      return { format: "module", source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
const globals = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  FormData: dom.window.FormData,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
};
const previousGlobals = new Map(
  Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);
for (const [name, value] of Object.entries(globals))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { HostSafetyForm } = await import("../../components/participation/host-safety-form.tsx");
const listingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let root;
let container;

beforeEach(() => {
  control.calls = [];
  control.error = null;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(() => {
  hooks.deregister();
  dom.window.close();
  delete globalThis.__qualiaSafetyFormTest;
  for (const [name, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

async function render(submission = null) {
  await act(async () => root.render(createElement(HostSafetyForm, { listingId, submission })));
}
function guardian() {
  return container.querySelector('[name="guardian_presence"]');
}
async function chooseGuardian(value) {
  await act(async () => {
    guardian().value = value;
    guardian().dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
}
async function save() {
  await act(async () => container.querySelector("form").requestSubmit());
}

test("guardian choice survives a successful action and a second save without reselecting", async () => {
  await render();
  await chooseGuardian("required");
  await save();
  assert.equal(control.calls[0].guardian_presence, "required");
  assert.equal(guardian().value, "required", "action completion must not reset the select");
  assert.match(container.querySelector('[role="status"]').textContent, /saved/i);

  await save();
  assert.equal(control.calls.length, 2);
  assert.equal(control.calls[1].guardian_presence, "required");
  assert.equal(control.calls[1].expectedRevision, "1");
  assert.equal(guardian().value, "required");
});

test("a failed save preserves the guardian selection for retry", async () => {
  await render();
  await chooseGuardian("not_required");
  control.error = "The oldest participant must be at least the minimum age.";
  await save();
  assert.equal(guardian().value, "not_required");
  assert.match(container.querySelector('[role="alert"]').textContent, /minimum age/);

  control.error = null;
  await save();
  assert.equal(control.calls[1].guardian_presence, "not_required");
  assert.equal(guardian().value, "not_required");
});

test("reopening a saved draft initializes and resubmits its saved guardian rule", async () => {
  await render({
    revision: 4,
    min_age: 12,
    max_age: 120,
    guardian_presence: "required",
    supervision_plan: "A guardian stays with each minor throughout the session.",
    review_status: "pending",
  });
  assert.equal(guardian().value, "required");
  assert.match(container.querySelector('[name="supervision_plan"]').value, /guardian stays/);
  await save();
  assert.equal(control.calls[0].expectedRevision, "4");
  assert.equal(control.calls[0].guardian_presence, "required");
  assert.equal(guardian().value, "required");
});
