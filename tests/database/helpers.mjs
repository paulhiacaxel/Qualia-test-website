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
