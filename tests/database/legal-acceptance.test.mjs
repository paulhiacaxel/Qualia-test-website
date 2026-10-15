/** Real PostgreSQL tests: signed-in people accept their own terms; no automatic consent. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import { createTestDatabase, asRole } from "./helpers.mjs";

let db;
const guestVersion = "qualia_guest_2026_10_13_v1";
const hostVersion = "qualia_host_2026_10_13_v2";
const ids = Object.fromEntries(
  ["guest", "host", "other", "unattested", "unverified", "anonymous", "oldHost"].map((name) => [
    name,
    randomUUID(),
  ]),
);
const as = (who, fn) => asRole(db, "authenticated", ids[who] ?? who, fn);
const accept = (scope = "guest", overrides = []) =>
  db.query(
    "select public.accept_legal_terms($1,$2,$3,$4,$5)",
    overrides.length
      ? overrides
      : [scope, guestVersion, scope === "host" ? hostVersion : null, true, true],
  );
const rejects = (fn, code) => assert.rejects(fn, (error) => error.code === code);
const status = async () =>
  (await db.query("select public.get_legal_acceptance() as result")).rows[0].result;
before(async () => {
  db = await createTestDatabase();
  for (const [name, id] of Object.entries(ids)) {
    await db.query(
      "insert into auth.users(id,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,$3,$4)",
      [
        id,
        name === "unverified" ? null : new Date(),
        name === "anonymous",
        { guest_accepted: true, host_accepted: true, terms_version: hostVersion },
      ],
    );
    if (!["unattested", "unverified", "anonymous"].includes(name))
      await as(name, () => db.query("select public.attest_adult_account(true,'adult_account_v1')"));
  }
});
after(async () => db?.close());

test("new and metadata-forged users have no legal acceptance", async () => {
  const current = await as("guest", status);
  assert.equal(current.guest_accepted, false);
  assert.equal(current.host_accepted, false);
  assert.deepEqual(current.records, []);
  assert.equal(
    (await db.query("select count(*)::integer as n from private.legal_acceptances")).rows[0].n,
    0,
  );
});

test("only verified, nonanonymous adult accounts can accept their own agreements", async () => {
  await rejects(() => asRole(db, "anon", null, () => accept()), "42501");
  for (const who of ["unattested", "unverified", "anonymous"])
    await rejects(() => as(who, () => accept()), "42501");
  await rejects(() => asRole(db, "service_role", null, () => accept()), "42501");
});

test("stale or unconfirmed agreement requests create no acceptance", async () => {
  for (const args of [
    ["guest", "outdated", null, true, true],
    ["guest", guestVersion, null, false, true],
    ["guest", guestVersion, null, true, null],
    ["host", guestVersion, null, true, true],
    ["guest", guestVersion, hostVersion, true, true],
    ["admin", guestVersion, hostVersion, true, true],
  ])
    await rejects(() => as("guest", () => accept("guest", args)), "22023");
  assert.equal((await as("guest", status)).records.length, 0);
});

test("guest acceptance records immutable actor, version, manifest and database time", async () => {
  await as("guest", () => accept());
  const current = await as("guest", status);
  assert.equal(current.guest_accepted, true);
  assert.equal(current.host_accepted, false);
  assert.equal(current.records.length, 1);
  assert.equal(current.records[0].version, guestVersion);
  assert.deepEqual(current.records[0].document_versions, {
    "/terms": guestVersion,
    "/cancellation-policy": "qualia_cancellation_2026_10_13_v1",
    "/privacy": "qualia_privacy_2026_10_13_v1",
  });
  assert.ok(Math.abs(Date.now() - Date.parse(current.records[0].accepted_at)) < 60_000);
  await as("guest", () => accept());
  assert.deepEqual(await as("guest", status), current);
  assert.equal((await as("other", status)).records.length, 0);
  await rejects(() => as("guest", () => db.query("select public.enable_host_mode()")), "42501");
});

test("host acceptance atomically records guest and full host-commercial agreement", async () => {
  await as("host", () => accept("host"));
  const current = await as("host", status);
  assert.equal(current.guest_accepted, true);
  assert.equal(current.host_accepted, true);
  assert.equal(current.records.length, 2);
  assert.equal(
    current.records.find((r) => r.scope === "host").document_versions["/host-terms"],
    hostVersion,
  );
  await as("host", () => db.query("select public.enable_host_mode()"));
  assert.equal(
    (await db.query("select is_host from public.profiles where id=$1", [ids.host])).rows[0].is_host,
    true,
  );
});

test("acceptance history cannot be inspected across accounts, fabricated or rewritten", async () => {
  await rejects(
    () => as("other", () => db.query("select * from private.legal_acceptances")),
    "42501",
  );
  await rejects(
    () =>
      as("other", () =>
        db.query(
          "insert into private.legal_acceptances(user_id,scope,version,document_versions) values($1,'guest',$2,'{}')",
          [ids.other, guestVersion],
        ),
      ),
    "42501",
  );
  await rejects(
    () =>
      db.query("update private.legal_acceptances set accepted_at=now() where user_id=$1", [
        ids.guest,
      ]),
    "42501",
  );
  await rejects(
    () => db.query("delete from private.legal_acceptances where user_id=$1", [ids.guest]),
    "42501",
  );
  await rejects(
    () =>
      asRole(db, "service_role", null, () =>
        db.query(
          "insert into private.legal_acceptances(user_id,scope,version,document_versions) values($1,'guest',$2,'{}')",
          [ids.other, guestVersion],
        ),
      ),
    "42501",
  );
  const p = (
    await db.query(
      "select has_function_privilege('authenticated','private.pay_reserve_checkout_before_legal(uuid,uuid,text,uuid,boolean)','EXECUTE') as user_bypass, has_function_privilege('service_role','private.pay_reserve_checkout_before_legal(uuid,uuid,text,uuid,boolean)','EXECUTE') as server_bypass",
    )
  ).rows[0];
  assert.deepEqual(p, { user_bypass: false, server_bypass: false });
});

test("existing connected-account access survives while new reservations need host acceptance", async () => {
  await db.query("update public.profiles set is_host=true where id=$1", [ids.oldHost]);
  await db.query(
    "insert into private.stripe_accounts(host_id,environment,account_id) values($1,'sandbox','acct_existing_legal_test')",
    [ids.oldHost],
  );
  const existing = await asRole(db, "service_role", null, () =>
    db.query("select private.pay_prepare_account($1,'sandbox') as result", [ids.oldHost]),
  );
  assert.equal(existing.rows[0].result.account_id, "acct_existing_legal_test");
  await rejects(
    () =>
      asRole(db, "service_role", null, () =>
        db.query("select private.pay_prepare_account($1,'live')", [ids.oldHost]),
      ),
    "42501",
  );
});
