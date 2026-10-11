import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createTestDatabase, asRole } from "../database/helpers.mjs";
import { miamiDateTime, reviewSchema } from "../../lib/admin/validation.ts";

let db;
const ids = Object.fromEntries(
  ["host", "other", "guest", "admin", "unverified", "anonymous"].map((name) => [
    name,
    randomUUID(),
  ]),
);
const checks = { profile: true, experience: true, location: true, risks: true };
const as = (name, operation) =>
  asRole(db, name === "anon" ? "anon" : "authenticated", ids[name] ?? null, operation);
const errorCode = (operation, code) => assert.rejects(operation, (error) => error.code === code);

before(async () => {
  db = await createTestDatabase();
  for (const [name, id] of Object.entries(ids)) {
    await db.query(
      "insert into auth.users(id, raw_user_meta_data, email_confirmed_at, is_anonymous) values ($1, $2, $3, $4)",
      [
        id,
        { full_name: name, role: "admin" },
        name === "unverified" ? null : new Date(),
        name === "anonymous",
      ],
    );
  }
  for (const name of ["admin", "unverified", "anonymous"]) {
    await db.query(
      "insert into private.admin_memberships(user_id, reason) values ($1, 'Test operator')",
      [ids[name]],
    );
  }
  for (const name of ["host", "other"]) {
    await as(name, async () => {
      await db.query("select public.enable_host_mode()");
      await db.query(
        "select public.save_host_profile($1, 'Established one-on-one teacher.', 'Miami', 'https://example.com/work')",
        [name],
      );
    });
  }
});
after(async () => db?.close());

async function listing({ submit = true, host = "host" } = {}) {
  return as(host, async () => {
    const { rows } = await db.query(
      "select public.create_listing('Personal lesson', 'Learn a specific skill one-on-one.', 'art', 15000, 90, 'Miami', 'Little Havana') as id",
    );
    const id = rows[0].id;
    await db.query(
      "select public.save_listing_location($1, 'PRIVATE REVIEW ADDRESS', '', '33135', 'Meet at the studio entrance.')",
      [id],
    );
    const photo = `${ids[host]}/${id}/${randomUUID()}.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id, name, owner_id) values ('listing-photos', $1, $2)",
      [photo, ids[host]],
    );
    await db.query("select public.add_listing_photo($1, $2, 'Studio demonstration', 0)", [
      id,
      photo,
    ]);
    await db.query(
      "select public.add_availability_window($1, now() + interval '10 days', now() + interval '10 days 3 hours')",
      [id],
    );
    if (submit) await db.query("select public.submit_listing_for_review($1)", [id]);
    return { id, photo };
  });
}
async function state(id) {
  const { rows } = await db.query(
    "select status, safety_status, consultation_status, updated_at::text as version from public.listings where id = $1",
    [id],
  );
  return rows[0];
}
async function act(id, action, extra = {}, actor = "admin") {
  const version = extra.version ?? (await state(id)).version;
  return as(actor, () =>
    db.query("select public.admin_review_listing($1, $2, $3, $4, $5, $6, $7, $8)", [
      id,
      action,
      version,
      extra.note ?? "Reviewed supporting information.",
      extra.feedback ?? "",
      extra.scheduled ?? null,
      extra.risks ?? "Reviewed tools, ventilation, and intended participant level.",
      extra.checks ?? checks,
    ]),
  );
}
async function approve(id) {
  await act(id, "approve_safety");
  await act(id, "waive_consultation");
}

test("only verified trusted administrators can read private review details or decide outcomes", async () => {
  const item = await listing();
  for (const actor of ["anon", "guest", "host", "other", "unverified", "anonymous"]) {
    await errorCode(
      () => as(actor, () => db.query("select public.admin_get_listing_review($1)", [item.id])),
      "42501",
    );
    await errorCode(() => act(item.id, "approve_safety", {}, actor), "42501");
  }
  const { rows } = await as("admin", () =>
    db.query("select public.admin_get_listing_review($1) as review", [item.id]),
  );
  assert.equal(rows[0].review.location.address_line1, "PRIVATE REVIEW ADDRESS");
  assert.equal(rows[0].review.photos.length, 1);
});

test("review storage access includes only registered submitted photos, with no write capability", async () => {
  const submitted = await listing();
  const draft = await listing({ submit: false });
  const orphan = `${ids.host}/${submitted.id}/${randomUUID()}.jpg`;
  await db.query(
    "insert into storage.objects(bucket_id, name, owner_id) values ('listing-photos', $1, $2)",
    [orphan, ids.host],
  );
  await as("admin", async () => {
    const { rows } = await db.query(
      "select name from storage.objects where name = any($1::text[])",
      [[submitted.photo, draft.photo, orphan]],
    );
    assert.deepEqual(rows, [{ name: submitted.photo }]);
    const result = await db.query("delete from storage.objects where name = $1 returning name", [
      submitted.photo,
    ]);
    assert.equal(result.rows.length, 0);
  });
});

test("three-stage review cannot be skipped and completed review publishes atomically", async () => {
  const { id } = await listing();
  await errorCode(() => act(id, "publish"), "55000");
  await act(id, "start_review");
  await errorCode(() => act(id, "approve_safety", { checks: { profile: true } }), "22023");
  await errorCode(() => act(id, "approve_safety", { risks: " " }), "22023");
  await act(id, "approve_safety");
  await errorCode(() => act(id, "publish"), "55000");
  await act(id, "waive_consultation");
  await act(id, "publish");
  assert.equal((await state(id)).status, "published");
  const events = await db.query(
    "select outcome from private.listing_review_events where listing_id = $1 order by created_at",
    [id],
  );
  assert.deepEqual(
    events.rows.map((row) => row.outcome),
    ["start_review", "approve_safety", "waive_consultation", "publish"],
  );
  const publicResult = await as("anon", () =>
    db.query("select id from public.listings where id = $1", [id]),
  );
  assert.equal(publicResult.rows.length, 1);
});

test("consultations must be required, scheduled in the future, then completed after their start", async () => {
  const { id } = await listing();
  await errorCode(() => act(id, "require_consultation"), "55000");
  await act(id, "approve_safety");
  await errorCode(() => act(id, "complete_consultation"), "55000");
  await act(id, "require_consultation");
  await errorCode(
    () => act(id, "schedule_consultation", { scheduled: "2000-01-01T15:00:00Z" }),
    "22023",
  );
  await act(id, "schedule_consultation", {
    scheduled: new Date(Date.now() + 86400000).toISOString(),
  });
  await errorCode(() => act(id, "complete_consultation"), "55000");
  // Simulate time passing in this isolated fixture, not a public mutation.
  await db.query(
    "update private.listing_review_details set consultation_scheduled_at = now() - interval '1 hour' where listing_id = $1",
    [id],
  );
  await act(id, "complete_consultation");
  await act(id, "publish");
  assert.equal((await state(id)).consultation_status, "completed");
});

test("publication rechecks files, future availability, and host verification", async () => {
  const missingPhoto = await listing();
  await approve(missingPhoto.id);
  await db.query("delete from storage.objects where name = $1", [missingPhoto.photo]);
  await errorCode(() => act(missingPhoto.id, "publish"), "22023");
  const expired = await listing();
  await approve(expired.id);
  await db.query(
    "update public.availability_windows set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where listing_id = $1",
    [expired.id],
  );
  await errorCode(() => act(expired.id, "publish"), "22023");
  const unverified = await listing({ host: "other" });
  await approve(unverified.id);
  await db.query("update auth.users set email_confirmed_at = null where id = $1", [ids.other]);
  try {
    await errorCode(() => act(unverified.id, "publish"), "22023");
  } finally {
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [ids.other]);
  }
});

test("stale decisions are rejected without overwriting a newer review", async () => {
  const { id } = await listing();
  const version = (await state(id)).version;
  await act(id, "start_review");
  await errorCode(() => act(id, "approve_safety", { version }), "40001");
  assert.equal((await state(id)).safety_status, "pending");
});

test("review-stage availability can be refreshed without changing approval or unlocking removals", async () => {
  const { id } = await listing();
  // Each review state permits only additive calendar maintenance.
  for (const [expectedState, days] of [
    ["submitted", 12],
    ["in_review", 14],
    ["approved", 16],
  ]) {
    if (expectedState === "in_review") await act(id, "approve_safety");
    if (expectedState === "approved") await act(id, "waive_consultation");
    const before = await state(id);
    assert.equal(before.status, expectedState);
    const window = await as("host", () =>
      db.query(
        "select public.add_availability_window($1, now() + $2 * interval '1 day', now() + $2 * interval '1 day' + interval '2 hours') as id",
        [id, days],
      ),
    );
    assert.deepEqual(await state(id), before);
    await errorCode(
      () =>
        as("host", () =>
          db.query("select public.remove_availability_window($1)", [window.rows[0].id]),
        ),
      "55000",
    );
    await errorCode(
      () =>
        as("other", () =>
          db.query(
            "select public.add_availability_window($1, now() + interval '20 days', now() + interval '20 days 2 hours')",
            [id],
          ),
        ),
      "42501",
    );
    await errorCode(
      () =>
        as("host", () =>
          db.query("select public.save_listing_location($1, 'Changed venue', '', '33135', '')", [
            id,
          ]),
        ),
      "55000",
    );
  }
  // Simulate review taking longer than every original window. Publication still
  // fails until the owner adds a new valid window, then uses the existing review.
  await db.query(
    "update public.availability_windows set starts_at = starts_at - interval '100 days', ends_at = ends_at - interval '100 days' where listing_id = $1",
    [id],
  );
  await errorCode(() => act(id, "publish"), "22023");
  await as("host", () =>
    db.query(
      "select public.add_availability_window($1, now() + interval '3 days', now() + interval '3 days 2 hours')",
      [id],
    ),
  );
  await act(id, "publish");
  assert.equal((await state(id)).status, "published");
  await act(id, "pause", { feedback: "Review a reported venue issue." });
  await errorCode(
    () =>
      as("host", () =>
        db.query(
          "select public.add_availability_window($1, now() + interval '4 days', now() + interval '4 days 2 hours')",
          [id],
        ),
      ),
    "55000",
  );
});

test("rejection explains required changes to the owner without exposing internal notes", async () => {
  const { id } = await listing();
  await errorCode(() => act(id, "reject"), "22023");
  await act(id, "reject", {
    note: "PRIVATE INTERNAL ASSESSMENT",
    feedback: "Please clarify the tools used.",
  });
  const feedback = await as("host", () =>
    db.query("select * from public.get_listing_review_feedback($1)", [id]),
  );
  assert.equal(feedback.rows[0].host_feedback, "Please clarify the tools used.");
  assert.deepEqual(Object.keys(feedback.rows[0]).sort(), ["host_feedback", "reviewed_at"]);
  await errorCode(
    () => as("other", () => db.query("select * from public.get_listing_review_feedback($1)", [id])),
    "42501",
  );
  await as("host", async () => {
    await db.query(
      "select public.save_listing($1, 'Clarified lesson', 'Clear teaching scope.', 'art', 15000, 90, 'Miami', 'Little Havana')",
      [id],
    );
    await db.query("select public.submit_listing_for_review($1)", [id]);
  });
  assert.equal((await state(id)).safety_status, "pending");
  await errorCode(() => act(id, "publish"), "55000");
});

test("pause hides a live listing and requires return-for-changes plus a fresh review", async () => {
  const { id } = await listing();
  await approve(id);
  await act(id, "publish");
  await act(id, "pause", { feedback: "The meeting location needs an update." });
  const visible = await as("anon", () =>
    db.query("select id from public.listings where id = $1", [id]),
  );
  assert.equal(visible.rows.length, 0);
  await errorCode(() => act(id, "publish"), "55000");
  await act(id, "reject", { feedback: "Please update the meeting address." });
  assert.equal((await state(id)).status, "rejected");
});

test("audit records and internal assessments cannot be read or mutated directly by app roles", async () => {
  for (const actor of ["host", "guest", "admin"]) {
    await as(actor, async () => {
      for (const table of ["private.listing_review_events", "private.listing_review_details"]) {
        await errorCode(() => db.query(`select * from ${table}`), "42501");
        await errorCode(() => db.query(`delete from ${table}`), "42501");
      }
      await errorCode(() => db.query("update public.listings set status = 'published'"), "42501");
    });
  }
});

test("review input validates meaningful decisions and rejects ambiguous Miami appointment times", () => {
  const valid = {
    listingId: randomUUID(),
    action: "approve_safety",
    expectedUpdatedAt: "2026-10-11T20:15:34.123456+00:00",
    note: "Reviewed the evidence.",
    riskNotes: "Reviewed tools and ventilation.",
    ...checks,
  };
  assert.equal(reviewSchema.safeParse(valid).success, true);
  assert.equal(reviewSchema.safeParse({ ...valid, risks: false }).success, false);
  assert.equal(
    reviewSchema.safeParse({ ...valid, action: "reject", hostFeedback: "" }).success,
    false,
  );
  assert.equal(reviewSchema.safeParse({ ...valid, action: "grant_admin" }).success, false);
  assert.equal(miamiDateTime("2026-10-15T14:00"), "2026-10-15T18:00:00Z");
  assert.throws(() => miamiDateTime("2026-11-01T01:30"));
  assert.throws(() => miamiDateTime("2027-03-14T02:30"));
});
