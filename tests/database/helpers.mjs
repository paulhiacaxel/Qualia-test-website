/** Isolated real-PostgreSQL harness; never connects to a remote project. */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export async function createTestDatabase({ beforeMigration } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb not null default '{}',
      email_confirmed_at timestamptz,
      is_anonymous boolean not null default false
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Minimal Storage catalog only; real byte uploads and MIME checks remain
    -- hosted integration tests. Policy behavior still runs inside PostgreSQL.
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null, owner_id text, metadata jsonb,
      unique(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
    -- Mimic legacy Supabase defaults to prove our explicit REVOKEs work.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  const migrationDir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort()) {
    // Optional fixture hook verifies upgrades against rows created under the old schema.
    await beforeMigration?.(db, name);
    await db.exec(await readFile(new URL(name, migrationDir), "utf8"));
  }
  return db;
}

export async function asRole(db, role, userId, operation) {
  // These are fixed test-only role names, never caller-controlled input.
  assert.ok(["anon", "authenticated", "service_role"].includes(role));
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await operation();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Explicit synthetic adult evidence; callers deliberately omit negative-test identities. */
export async function attestFixtureAdult(db, userId) {
  await asRole(db, "authenticated", userId, () =>
    db.query("select public.attest_adult_account(true, 'adult_account_v1')"),
  );
}

/**
 * Explicit acceptance by a synthetic fixture identity only. This is separate from
 * age attestation so tests can deliberately omit either requirement. No hosted
 * user or production consent record is created by this helper.
 */
export async function acceptFixtureLegal(db, userId, { host = false } = {}) {
  await asRole(db, "authenticated", userId, () =>
    db.query("select public.accept_legal_terms($1, $2, $3, true, true)", [
      host ? "host" : "guest",
      "qualia_guest_2026_10_13_v1",
      host ? "qualia_host_2026_10_13_v2" : null,
    ]),
  );
}

/** Every legacy fixture describes its synthetic activity instead of bypassing review. */
export function fixtureSafetySubmission(overrides = {}) {
  return {
    min_age: 18,
    max_age: 120,
    guardian_presence: "not_required",
    participation_rules: "Synthetic adult lesson: follow the host's instructions throughout.",
    hazards: "Synthetic fixture: reviewed ordinary studio and equipment hazards.",
    equipment: "Synthetic fixture: host provides inspected equipment and protective supplies.",
    prerequisites: "Synthetic fixture: no prior experience is required.",
    supervision_plan: "Synthetic fixture: host supervises the single participant throughout.",
    credentials_evidence: "Synthetic fixture evidence: instructor's relevant training reviewed.",
    insurance_evidence: "Synthetic fixture evidence: suitable activity coverage reviewed.",
    venue_evidence: "Synthetic fixture evidence: private teaching venue reviewed.",
    emergency_plan:
      "Synthetic fixture: stop the activity and contact emergency services if needed.",
    evidence_expires_on: null,
    ...overrides,
  };
}

export function adultParticipant(rulesRevision = 1) {
  return {
    kind: "self",
    age_at_experience: 30,
    adult_booker_confirmed: true,
    rules_accepted: true,
    guardian_authority_confirmed: false,
    guardian_presence_accepted: false,
    rules_revision: rulesRevision,
  };
}

/**
 * Opt-in setup for tests whose subject is booking/finance, not listing publication.
 * Evidence and review use real commands. Only pre-existing synthetic catalog state
 * is assembled directly, as in the surrounding fixtures; production code is untouched.
 */
export async function approveFixtureSafety(
  db,
  { listingId, hostId, adminId, targetStatus = "published" },
) {
  const submitted = await asRole(db, "authenticated", hostId, () =>
    db.query("select public.save_listing_safety_submission($1, null, $2) as revision", [
      listingId,
      fixtureSafetySubmission(),
    ]),
  );
  const revision = submitted.rows[0].revision;
  await db.query(
    "update public.listings set status='submitted', safety_status='pending', consultation_status='not_requested', published_at=null where id=$1",
    [listingId],
  );
  await asRole(db, "authenticated", adminId, () =>
    db.query(
      "select public.admin_review_listing_safety($1,$2,'approved','Synthetic reviewed activity notes','2100-01-01T00:00:00Z',false)",
      [listingId, revision],
    ),
  );
  await db.query(
    "update public.listings set status=$2::public.listing_status, safety_status='approved', consultation_status='waived', published_at=case when $2='published' then now() else null end where id=$1",
    [listingId, targetStatus],
  );
  return revision;
}
