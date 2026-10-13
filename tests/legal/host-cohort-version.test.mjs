import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { createTestDatabase, asRole } from "../database/helpers.mjs";

// Follow the same published-document selector as the website, using Node's TS loader.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith("./archive/") &&
      context.parentURL?.endsWith("/lib/legal/documents.ts")
    )
      return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { hostTerms, guestTerms, legalDocuments, getArchivedLegalDocument } =
  await import("../../lib/legal/documents.ts");
const { HOST_TERMS_VERSION, GUEST_TERMS_VERSION } = await import("../../lib/legal/versions.ts");
const oldHostVersion = "qualia_host_2026_10_13_v1";
const currentHostVersion = "qualia_host_2026_10_13_v2";
const guestVersion = "qualia_guest_2026_10_13_v1";

test("current host publication changes only cohort size and keeps both permanent archives", () => {
  const original = getArchivedLegalDocument(oldHostVersion);
  assert.ok(original);
  assert.equal(hostTerms.version, HOST_TERMS_VERSION);
  assert.equal(hostTerms.version, currentHostVersion);
  assert.equal(guestTerms.version, GUEST_TERMS_VERSION);
  assert.equal(guestTerms.version, guestVersion);
  assert.equal(legalDocuments.filter((document) => document.href === "/host-terms").length, 1);
  assert.equal(getArchivedLegalDocument(currentHostVersion), hostTerms);
  assert.equal(getArchivedLegalDocument("unknown"), null);
  assert.match(JSON.stringify(original), /first 40 verified hosts/);
  assert.match(JSON.stringify(hostTerms), /first 30 verified hosts/);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(hostTerms)
        .replace(currentHostVersion, oldHostVersion)
        .replace("first 30 verified hosts", "first 40 verified hosts"),
    ),
    original,
  );
});

test("host v2 upgrade preserves v1 evidence and guest acceptance without accepting unseen terms", async () => {
  const userId = randomUUID();
  let originalRecords;
  const db = await createTestDatabase({
    beforeMigration: async (connection, name) => {
      if (!name.endsWith("_founding_cohort_host_terms_v2.sql")) return;
      await connection.query("insert into auth.users(id,email_confirmed_at) values($1,now())", [
        userId,
      ]);
      await asRole(connection, "authenticated", userId, async () => {
        await connection.query("select public.attest_adult_account(true,'adult_account_v1')");
        await connection.query("select public.accept_legal_terms('host',$1,$2,true,true)", [
          guestVersion,
          oldHostVersion,
        ]);
      });
      originalRecords = (
        await connection.query("select * from private.legal_acceptances order by scope")
      ).rows;
    },
  });
  const getStatus = async () =>
    (await db.query("select public.get_legal_acceptance() as result")).rows[0].result;
  try {
    const status = await asRole(db, "authenticated", userId, getStatus);
    assert.equal(status.guest_accepted, true);
    assert.equal(status.host_accepted, false);
    assert.equal(status.guest_version, guestVersion);
    assert.equal(status.host_version, currentHostVersion);
    assert.deepEqual(
      (await db.query("select * from private.legal_acceptances order by scope")).rows,
      originalRecords,
    );
    await assert.rejects(
      () =>
        asRole(db, "authenticated", userId, () =>
          db.query("select public.accept_legal_terms('host',$1,$2,true,true)", [
            guestVersion,
            oldHostVersion,
          ]),
        ),
      (error) => error.code === "22023",
    );
    await assert.rejects(
      () => asRole(db, "authenticated", userId, () => db.query("select public.enable_host_mode()")),
      (error) => error.code === "42501",
    );
    await asRole(db, "authenticated", userId, () =>
      db.query("select public.accept_legal_terms('host',$1,$2,true,true)", [
        guestVersion,
        currentHostVersion,
      ]),
    );
    const accepted = await asRole(db, "authenticated", userId, getStatus);
    assert.equal(accepted.guest_accepted, true);
    assert.equal(accepted.host_accepted, true);
    assert.equal(accepted.records.length, 3);
    assert.deepEqual(
      (
        await db.query("select * from private.legal_acceptances where version<>$1 order by scope", [
          currentHostVersion,
        ])
      ).rows,
      originalRecords,
    );
    assert.deepEqual(
      accepted.records.find((record) => record.version === currentHostVersion).document_versions,
      {
        "/terms": guestVersion,
        "/host-terms": currentHostVersion,
        "/cancellation-policy": "qualia_cancellation_2026_10_13_v1",
        "/privacy": "qualia_privacy_2026_10_13_v1",
      },
    );
    await asRole(db, "authenticated", userId, () =>
      db.query("select public.accept_legal_terms('host',$1,$2,true,true)", [
        guestVersion,
        currentHostVersion,
      ]),
    );
    assert.deepEqual(await asRole(db, "authenticated", userId, getStatus), accepted);
  } finally {
    await db.close();
  }
});
