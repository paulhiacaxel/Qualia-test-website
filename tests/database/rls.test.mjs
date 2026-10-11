/**
 * Real PostgreSQL permission/RLS tests, in an isolated in-memory PGlite database.
 * Supabase's auth schema and request identity are minimally simulated; this is
 * not a substitute for hosted GoTrue, PostgREST, Storage or SMTP integration tests.
 * Never point this harness at a production database.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  alice: "10000000-0000-0000-0000-000000000001",
  bob: "10000000-0000-0000-0000-000000000002",
  guest: "10000000-0000-0000-0000-000000000003",
  stranger: "10000000-0000-0000-0000-000000000004",
  admin: "10000000-0000-0000-0000-000000000005",
  unverified: "10000000-0000-0000-0000-000000000006",
  anonymous: "10000000-0000-0000-0000-000000000007",
  draft: "20000000-0000-0000-0000-000000000001",
  published: "20000000-0000-0000-0000-000000000002",
  aliceLive: "20000000-0000-0000-0000-000000000003",
};
const db = new PGlite();

async function asRole(role, userId, operation) {
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
const denied = (operation) => assert.rejects(operation, (error) => error.code === "42501");

before(async () => {
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
    -- Mimic legacy Supabase defaults to prove our explicit REVOKEs work.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  const migrationDir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, migrationDir), "utf8"));
  }
  for (const key of ["alice", "bob", "guest", "stranger", "admin", "unverified", "anonymous"]) {
    await db.query(
      `insert into auth.users(id, raw_user_meta_data, email_confirmed_at, is_anonymous)
      values ($1, $2, $3, $4)`,
      [
        ids[key],
        { full_name: key, role: "admin", is_host: true, wants_host: true },
        key === "unverified" ? null : "2026-10-11T12:00:00Z",
        key === "anonymous",
      ],
    );
  }
  await db.query(
    `insert into private.admin_memberships(user_id, reason) values ($1, 'Test operator grant')`,
    [ids.admin],
  );
  for (const user of ["alice", "bob"]) {
    await db.query(
      `insert into public.host_profiles(user_id, display_name, city) values ($1, $2, 'Miami')`,
      [ids[user], user],
    );
  }
  for (const [id, hostId, isPublished] of [
    [ids.draft, ids.alice, false],
    [ids.published, ids.bob, true],
    [ids.aliceLive, ids.alice, true],
  ]) {
    await db.query(
      `insert into public.listings (
      id, host_id, title, category, price_cents, duration_minutes, city,
      status, safety_status, consultation_status, published_at
    ) values ($1, $2, 'Private lesson', 'cooking', 15000, 90, 'Miami', $3, $4, $5, $6)`,
      [
        id,
        hostId,
        isPublished ? "published" : "draft",
        isPublished ? "approved" : "pending",
        isPublished ? "waived" : "not_requested",
        isPublished ? "2026-10-11T12:00:00Z" : null,
      ],
    );
    await db.query(
      `insert into private.listing_locations(listing_id, address_line1, postal_code) values ($1, 'PRIVATE TEST ADDRESS', '33101')`,
      [id],
    );
    await db.query(`insert into public.listing_photos(listing_id, storage_path) values ($1, $2)`, [
      id,
      `private/${id}/photo.jpg`,
    ]);
    await db.query(
      `insert into public.availability_windows(listing_id, host_id, starts_at, ends_at)
      values ($1, $2, '2026-11-01T15:00:00Z', '2026-11-01T18:00:00Z')`,
      [id, hostId],
    );
  }
  for (const [listing, host, guest] of [
    [ids.aliceLive, ids.alice, ids.guest],
    [ids.published, ids.bob, ids.stranger],
  ]) {
    await db.query(
      `insert into public.bookings(listing_id, host_id, guest_id, starts_at, ends_at, status, amount_cents)
      values ($1, $2, $3, '2026-11-01T15:00:00Z', '2026-11-01T16:30:00Z', 'confirmed', 15000)`,
      [listing, host, guest],
    );
  }
});
after(async () => db.close());

test("all application tables in exposed and private schemas have RLS enabled", async () => {
  const { rows } = await db.query(`select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(rows, []);
});

test("signup trigger ignores forged host/admin metadata", async () => {
  const { rows } = await db.query("select full_name, is_host from public.profiles where id = $1", [
    ids.guest,
  ]);
  assert.deepEqual(rows, [{ full_name: "guest", is_host: false }]);
  const result = await asRole("authenticated", ids.guest, () =>
    db.query("select public.is_admin() as allowed"),
  );
  assert.equal(result.rows[0].allowed, false);
});

test("signed-out visitors see published listings and photos only", async () => {
  await asRole("anon", null, async () => {
    const listings = await db.query("select id from public.listings order by id");
    assert.deepEqual(
      listings.rows.map((row) => row.id),
      [ids.published, ids.aliceLive],
    );
    const photos = await db.query(
      "select listing_id from public.listing_photos order by listing_id",
    );
    assert.deepEqual(
      photos.rows.map((row) => row.listing_id),
      [ids.published, ids.aliceLive],
    );
    const windows = await db.query(
      "select listing_id from public.availability_windows order by listing_id",
    );
    assert.deepEqual(
      windows.rows.map((row) => row.listing_id),
      [ids.published, ids.aliceLive],
    );
  });
});

test("signed-out visitors cannot read profiles, bookings, exact addresses, or admin roles", async () => {
  await asRole("anon", null, async () => {
    for (const table of [
      "public.profiles",
      "public.bookings",
      "private.listing_locations",
      "private.admin_memberships",
    ]) {
      await denied(() => db.query(`select * from ${table}`));
    }
    await denied(() => db.query("select public.is_admin()"));
    await denied(() => db.query("select public.enable_host_mode()"));
  });
});

test("account profiles are owner-only and self-service edits cannot change ownership or capabilities", async () => {
  await asRole("authenticated", ids.guest, async () => {
    const profiles = await db.query("select id from public.profiles");
    assert.deepEqual(profiles.rows, [{ id: ids.guest }]);
    const update = await db.query(
      "update public.profiles set full_name = 'Updated name' where id = $1 returning full_name",
      [ids.guest],
    );
    assert.equal(update.rows[0].full_name, "Updated name");
    const other = await db.query(
      "update public.profiles set full_name = 'Stolen' where id = $1 returning id",
      [ids.stranger],
    );
    assert.deepEqual(other.rows, []);
    await denied(() =>
      db.query("update public.profiles set is_host = true where id = $1", [ids.guest]),
    );
    await denied(() =>
      db.query("update public.profiles set id = $1 where id = $2", [ids.stranger, ids.guest]),
    );
    await denied(() =>
      db.query("update public.profiles set created_at = now() where id = $1", [ids.guest]),
    );
    await denied(() => db.query("insert into public.profiles(id) values ($1)", [ids.stranger]));
    await denied(() => db.query("delete from public.profiles where id = $1", [ids.guest]));
  });
});

test("verified members can opt into hosting idempotently without losing guest booking access", async () => {
  await asRole("authenticated", ids.guest, async () => {
    await db.query("select public.enable_host_mode()");
    await db.query("select public.enable_host_mode()");
    const profile = await db.query("select is_host from public.profiles");
    assert.equal(profile.rows[0].is_host, true);
    const bookings = await db.query("select guest_id from public.bookings");
    assert.deepEqual(bookings.rows, [{ guest_id: ids.guest }]);
    const admin = await db.query("select public.is_admin() as allowed");
    assert.equal(admin.rows[0].allowed, false);
  });
});

test("anonymous Auth users, unverified users, and missing identities cannot opt into hosting", async () => {
  for (const userId of [ids.anonymous, ids.unverified, null]) {
    await asRole("authenticated", userId, async () => {
      await denied(() => db.query("select public.enable_host_mode()"));
    });
  }
});

test("host ownership reveals own draft but never another host draft", async () => {
  await asRole("authenticated", ids.alice, async () => {
    const { rows } = await db.query("select id from public.listings order by id");
    assert.deepEqual(
      rows.map((row) => row.id),
      [ids.draft, ids.published, ids.aliceLive],
    );
  });
  await asRole("authenticated", ids.bob, async () => {
    const { rows } = await db.query("select id from public.listings order by id");
    assert.deepEqual(
      rows.map((row) => row.id),
      [ids.published, ids.aliceLive],
    );
  });
});

test("booking information is visible only to its guest, host, or trusted admin", async () => {
  for (const [userId, expectedCount] of [
    [ids.guest, 1],
    [ids.alice, 1],
    [ids.bob, 1],
    [ids.admin, 2],
    [ids.unverified, 0],
  ]) {
    await asRole("authenticated", userId, async () => {
      const { rows } = await db.query("select * from public.bookings");
      assert.equal(rows.length, expectedCount);
    });
  }
});

test("trusted membership is readable only by its member and cannot be self-granted", async () => {
  await asRole("authenticated", ids.guest, async () => {
    const { rows } = await db.query("select user_id from private.admin_memberships");
    assert.deepEqual(rows, []);
    await denied(() => db.query("select reason from private.admin_memberships"));
    await denied(() =>
      db.query("insert into private.admin_memberships(user_id, reason) values ($1, 'forged')", [
        ids.guest,
      ]),
    );
    await denied(() => db.query("delete from private.admin_memberships"));
  });
  await asRole("authenticated", ids.admin, async () => {
    const result = await db.query("select public.is_admin() as allowed");
    assert.equal(result.rows[0].allowed, true);
    const { rows } = await db.query("select id from public.listings");
    assert.equal(rows.length, 3);
  });
});

test("future host/listing/availability/booking mutations fail closed for hosts and admins", async () => {
  for (const userId of [ids.alice, ids.admin]) {
    await asRole("authenticated", userId, async () => {
      await denied(() =>
        db.query(
          "update public.listings set status = 'published', safety_status = 'approved', consultation_status = 'waived', published_at = now() where id = $1",
          [ids.draft],
        ),
      );
      await denied(() => db.query("update public.bookings set status = 'confirmed'"));
      await denied(() => db.query("delete from public.listings where id = $1", [ids.draft]));
      await denied(() => db.query("delete from public.availability_windows"));
      await denied(() => db.query("delete from public.listing_photos"));
      await denied(() => db.query("update public.host_profiles set bio = 'unreviewed'"));
      await denied(() =>
        db.query(
          `insert into public.bookings(listing_id, host_id, guest_id, starts_at, ends_at, amount_cents)
        values ($1, $2, $3, now(), now() + interval '1 hour', 1)`,
          [ids.published, ids.bob, ids.guest],
        ),
      );
    });
  }
});

test("even booking participants and admins cannot directly retrieve private location data", async () => {
  for (const userId of [ids.guest, ids.alice, ids.admin]) {
    await asRole("authenticated", userId, async () => {
      await denied(() => db.query("select * from private.listing_locations"));
      await denied(() => db.query("select * from private.listing_review_events"));
    });
  }
});

test("database publication constraint requires safety approval and consultation decision", async () => {
  await assert.rejects(
    () =>
      db.query(
        "update public.listings set status = 'published', published_at = now() where id = $1",
        [ids.draft],
      ),
    (error) => error.code === "23514",
  );
  await assert.rejects(
    () =>
      db.query(
        "update public.listings set status = 'published', safety_status = 'approved', published_at = now() where id = $1",
        [ids.draft],
      ),
    (error) => error.code === "23514",
  );
});

test("booking foundation rejects mismatched listing host and self-booking", async () => {
  const sql = `insert into public.bookings(listing_id, host_id, guest_id, starts_at, ends_at, amount_cents)
    values ($1, $2, $3, '2026-11-02T15:00:00Z', '2026-11-02T16:00:00Z', 15000)`;
  await assert.rejects(
    () => db.query(sql, [ids.published, ids.alice, ids.guest]),
    (error) => error.code === "23503",
  );
  await assert.rejects(
    () => db.query(sql, [ids.published, ids.bob, ids.bob]),
    (error) => error.code === "23514",
  );
});

test("service role is trusted and remains able to access records for later backend commands", async () => {
  await asRole("service_role", null, async () => {
    const { rows } = await db.query("select * from private.listing_locations");
    assert.equal(rows.length, 3);
  });
});

test("no public SECURITY DEFINER function can accidentally become a privileged RPC", async () => {
  const { rows } = await db.query(`select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef`);
  assert.deepEqual(rows, []);
  await asRole("authenticated", ids.guest, async () => {
    await denied(() => db.query("select private.bootstrap_profile()"));
  });
});
