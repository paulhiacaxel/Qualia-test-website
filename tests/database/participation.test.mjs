/** Activity participation uses synthetic adults and ages only: no child identity data.
 * Real PostgreSQL permissions, triggers and RPCs run in an isolated PGlite instance.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import { createTestDatabase, asRole, acceptFixtureLegal } from "./helpers.mjs";

let db;
const ids = Object.fromEntries(
  ["host", "guest", "other", "admin", "unattested", "unverified", "anonymous"].map((k) => [
    k,
    randomUUID(),
  ]),
);
const as = (who, run) => asRole(db, "authenticated", ids[who] ?? who, run);
const scalar = async (name, args = []) =>
  (
    await db.query(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
      args,
    )
  ).rows[0].result;
const rejects = (fn, code) => assert.rejects(fn, (e) => e.code === code);
const complete = (extra = {}) => ({
  min_age: 18,
  max_age: 120,
  guardian_presence: "not_required",
  participation_rules: "Follow the reviewed activity instructions.",
  hazards: "Minor hand-tool hazards described before use.",
  equipment: "Host supplies inspected equipment.",
  prerequisites: "No previous experience required.",
  supervision_plan: "Host remains present throughout.",
  credentials_evidence: "PRIVATE synthetic training evidence reviewed.",
  insurance_evidence: "PRIVATE synthetic coverage assessment.",
  venue_evidence: "PRIVATE synthetic venue permission.",
  emergency_plan: "PRIVATE synthetic emergency plan.",
  evidence_expires_on: null,
  ...extra,
});
const participant = (revision, extra = {}) => ({
  kind: "self",
  age_at_experience: 30,
  adult_booker_confirmed: true,
  rules_accepted: true,
  guardian_authority_confirmed: false,
  guardian_presence_accepted: false,
  rules_revision: revision,
  ...extra,
});
let counter = 0;
const legacy = {
  host: randomUUID(),
  guest: randomUUID(),
  listing: randomUUID(),
  booking: randomUUID(),
};
before(async () => {
  db = await createTestDatabase({
    beforeMigration: async (connection, name) => {
      if (!name.endsWith("_versioned_launch_legal_acceptance.sql")) return;
      // Historical state is created before the new legal schema exists. Never
      // disable a guard or create acceptance for this unattested legacy user.
      await connection.query(
        "insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now())",
        [legacy.host, legacy.guest],
      );
      await connection.query("update public.profiles set is_host=true where id=$1", [legacy.host]);
      await connection.query(
        "insert into public.host_profiles(user_id,display_name,city) values($1,'Historical synthetic host','Miami')",
        [legacy.host],
      );
      await connection.query(
        "insert into public.listings(id,host_id,title,category,price_cents,duration_minutes,city) values($1,$2,'Historical synthetic lesson','art',10000,60,'Miami')",
        [legacy.listing, legacy.host],
      );
      await connection.query(
        "insert into public.bookings(id,listing_id,host_id,guest_id,starts_at,ends_at,status,amount_cents) values($1,$2,$3,$4,'2099-12-01T14:00Z','2099-12-01T15:00Z','confirmed',10000)",
        [legacy.booking, legacy.listing, legacy.host, legacy.guest],
      );
    },
  });
  for (const [name, id] of Object.entries(ids)) {
    await db.query(
      "insert into auth.users(id,raw_user_meta_data,email_confirmed_at,is_anonymous) values($1,$2,$3,$4)",
      [
        id,
        {
          full_name: "Synthetic " + name,
          adult_attested_at: "2000-01-01",
          adult_attestation_version: "adult_account_v1",
          is_adult: true,
        },
        name === "unverified" ? null : new Date(),
        name === "anonymous",
      ],
    );
    if (!["unattested", "unverified", "anonymous"].includes(name)) {
      await as(name, () => scalar("attest_adult_account", [true, "adult_account_v1"]));
      await acceptFixtureLegal(db, id, { host: name === "host" });
    }
  }
  await db.query(
    "insert into private.admin_memberships(user_id,reason) values($1,'Synthetic review operator')",
    [ids.admin],
  );
  await as("host", async () => {
    await scalar("enable_host_mode");
    await scalar("save_host_profile", [
      "Synthetic host",
      "Synthetic instruction portfolio.",
      "Miami",
      null,
    ]);
  });
  await as("admin", () => scalar("admin_set_booking_policy", [1440, 1440, true]));
});
after(async () => db?.close());
async function freshGuest() {
  const id = randomUUID();
  await db.query("insert into auth.users(id,email_confirmed_at) values($1,now())", [id]);
  await as(id, () => scalar("attest_adult_account", [true, "adult_account_v1"]));
  await acceptFixtureLegal(db, id);
  return id;
}
async function state(id) {
  return (
    await db.query(
      "select status,safety_status,participation_rules,updated_at::text as version from public.listings where id=$1",
      [id],
    )
  ).rows[0];
}
async function act(id, action) {
  const version = (await state(id)).version;
  return as("admin", () =>
    scalar("admin_review_listing", [
      id,
      action,
      version,
      "Reviewed synthetic evidence.",
      "",
      null,
      "Recorded activity-specific synthetic risk assessment.",
      { profile: true, experience: true, location: true, risks: true },
    ]),
  );
}
async function fixture({
  submission = complete(),
  publish = true,
  review = true,
  guardianOverride = false,
  validUntil = "2100-01-01T00:00:00Z",
} = {}) {
  const start = new Date(Date.UTC(2099, 5, 1 + counter++, 14)).toISOString();
  const end = new Date(Date.parse(start) + 3600000).toISOString();
  const guest = await freshGuest();
  const id = await as("host", () =>
    scalar("create_listing", [
      "Synthetic lesson",
      "Learn a clearly specified skill.",
      "art",
      10000,
      60,
      "Miami",
      "Wynwood",
    ]),
  );
  await as("host", async () => {
    await scalar("save_listing_location", [
      id,
      "SYNTHETIC PRIVATE VENUE",
      "",
      "33127",
      "Meet the host.",
    ]);
    const path = `${ids.host}/${id}/${randomUUID()}.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values('listing-photos',$1,$2)",
      [path, ids.host],
    );
    await scalar("add_listing_photo", [id, path, "Synthetic demonstration", 0]);
    await scalar("add_availability_window", [
      id,
      start,
      new Date(Date.parse(start) + 3 * 3600000).toISOString(),
    ]);
  });
  const revision = await as("host", () =>
    scalar("save_listing_safety_submission", [id, null, submission]),
  );
  if (review) {
    await as("host", () => scalar("submit_listing_for_review", [id]));
    await as("admin", () =>
      scalar("admin_review_listing_safety", [
        id,
        revision,
        "approved",
        "Reviewed exact synthetic activity and evidence.",
        validUntil,
        guardianOverride,
      ]),
    );
  }
  if (publish) {
    await act(id, "approve_safety");
    await act(id, "waive_consultation");
    await act(id, "publish");
  }
  return { id, start, end, revision, guest };
}
const request = (f, details = participant(f.revision), guest = f.guest) =>
  as(guest, () => scalar("request_booking", [f.id, f.start, "Synthetic request", details]));

test("guardian choice persists across saves; completing the last safety note allows submission", async () => {
  const draft = complete({ min_age: 15, guardian_presence: "required", insurance_evidence: "" });
  const f = await fixture({ submission: draft, publish: false, review: false });
  let revision = f.revision;
  for (let save = 0; save < 2; save++) {
    const saved = await as("host", () => scalar("get_listing_safety_submission", [f.id]));
    assert.equal(saved.guardian_presence, "required");
    assert.equal(saved.revision, revision);
    revision = await as("host", () =>
      scalar("save_listing_safety_submission", [f.id, revision, draft]),
    );
  }
  await rejects(() => as("host", () => scalar("submit_listing_for_review", [f.id])), "22023");
  assert.equal((await state(f.id)).status, "draft");
  await as("host", () =>
    scalar("save_listing_safety_submission", [
      f.id,
      revision,
      {
        ...draft,
        insurance_evidence: "Synthetic host reports coverage is unconfirmed; review needed.",
      },
    ]),
  );
  await as("host", () => scalar("submit_listing_for_review", [f.id]));
  const submitted = await state(f.id);
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.participation_rules, null);
});

test("untrusted signup metadata cannot create adult eligibility and host entry needs explicit attestation", async () => {
  const result = await as("unattested", () => scalar("get_account_eligibility"));
  assert.equal(result.eligible, false);
  assert.equal(result.adult_attested_at, null);
  await rejects(() => as("unattested", () => scalar("enable_host_mode")), "42501");
  await rejects(
    () =>
      as("unattested", () =>
        db.query(
          "update public.profiles set adult_attested_at=now(),adult_attestation_version='adult_account_v1' where id=$1",
          [ids.unattested],
        ),
      ),
    "42501",
  );
  await rejects(
    () => as("unattested", () => scalar("attest_adult_account", [false, "adult_account_v1"])),
    "22023",
  );
  await rejects(
    () => as("unattested", () => scalar("attest_adult_account", [true, "unapproved_version"])),
    "22023",
  );
});
test("unverified, anonymous and missing identities cannot attest; repeated valid attestation preserves provenance", async () => {
  for (const who of ["unverified", "anonymous"])
    await rejects(
      () => as(who, () => scalar("attest_adult_account", [true, "adult_account_v1"])),
      "42501",
    );
  await rejects(
    () =>
      asRole(db, "anon", null, () => scalar("attest_adult_account", [true, "adult_account_v1"])),
    "42501",
  );
  const before = await as("guest", () => scalar("get_account_eligibility"));
  await as("guest", () => scalar("attest_adult_account", [true, "adult_account_v1"]));
  assert.deepEqual(await as("guest", () => scalar("get_account_eligibility")), before);
});
test("incomplete drafts save but cannot submit; draft payload cannot smuggle review approval", async () => {
  const f = await fixture({ submission: {}, publish: false, review: false });
  const saved = await as("host", () => scalar("get_listing_safety_submission", [f.id]));
  assert.equal(saved.min_age, null);
  assert.equal(saved.review_status, "pending");
  await rejects(() => as("host", () => scalar("submit_listing_for_review", [f.id])), "22023");
  await rejects(
    () =>
      as("host", () =>
        scalar("save_listing_safety_submission", [
          f.id,
          f.revision,
          { ...complete(), review_status: "approved" },
        ]),
      ),
    "22023",
  );
  await rejects(
    () =>
      as("other", () => scalar("save_listing_safety_submission", [f.id, f.revision, complete()])),
    "42501",
  );
});
test("submitted activity needs its own reviewed revision before existing safety approval or publication", async () => {
  const f = await fixture({ publish: false, review: false });
  await as("host", () => scalar("submit_listing_for_review", [f.id]));
  await rejects(() => act(f.id, "approve_safety"), "55000");
  await rejects(
    () =>
      db.query(
        "update public.listings set status='published',safety_status='approved',consultation_status='waived',published_at=now() where id=$1",
        [f.id],
      ),
    "55000",
  );
  await rejects(
    () =>
      as("host", () =>
        scalar("admin_review_listing_safety", [
          f.id,
          f.revision,
          "approved",
          "Forged review.",
          "2100-01-01",
          false,
        ]),
      ),
    "42501",
  );
  await rejects(
    () =>
      as("admin", () =>
        scalar("admin_review_listing_safety", [
          f.id,
          f.revision + 1,
          "approved",
          "Stale review.",
          "2100-01-01",
          false,
        ]),
      ),
    "40001",
  );
});
test("minor supervision without guardian needs explicit administrator decision and leaves append-only provenance", async () => {
  const f = await fixture({
    submission: complete({ min_age: 8, guardian_presence: "not_required" }),
    publish: false,
    review: false,
  });
  await as("host", () => scalar("submit_listing_for_review", [f.id]));
  await rejects(
    () =>
      as("admin", () =>
        scalar("admin_review_listing_safety", [
          f.id,
          f.revision,
          "approved",
          "Review supervision.",
          "2100-01-01",
          false,
        ]),
      ),
    "22023",
  );
  await as("admin", () =>
    scalar("admin_review_listing_safety", [
      f.id,
      f.revision,
      "approved",
      "Explicitly approved alternative supervision.",
      "2100-01-01",
      true,
    ]),
  );
  const audit = (
    await db.query(
      "select reviewer_id,revision,submission_snapshot from private.listing_safety_review_history where listing_id=$1",
      [f.id],
    )
  ).rows[0];
  assert.equal(audit.reviewer_id, ids.admin);
  assert.equal(audit.revision, f.revision);
  assert.equal(audit.submission_snapshot.minor_without_guardian_approved, true);
  await rejects(
    () => db.query("delete from private.listing_safety_review_history where listing_id=$1", [f.id]),
    "55000",
  );
});
test("public rules never expose private evidence or reviewer notes; other hosts cannot read the submission", async () => {
  const f = await fixture();
  const rules = await asRole(db, "anon", null, () =>
    scalar("get_listing_participation_rules", [f.id]),
  );
  assert.deepEqual(
    Object.keys(rules).sort(),
    [
      "revision",
      "min_age",
      "max_age",
      "guardian_presence",
      "participation_rules",
      "hazards",
      "equipment",
      "prerequisites",
      "supervision_plan",
      "valid_until",
    ].sort(),
  );
  assert.ok(!JSON.stringify(rules).includes("PRIVATE"));
  const row = await asRole(db, "anon", null, () =>
    db.query("select participation_rules from public.listings where id=$1", [f.id]),
  );
  assert.deepEqual(row.rows[0].participation_rules, rules);
  for (const who of ["other", f.guest])
    await rejects(() => as(who, () => scalar("get_listing_safety_submission", [f.id])), "42501");
  await rejects(
    () =>
      asRole(db, "anon", null, () => db.query("select * from private.listing_safety_submissions")),
    "42501",
  );
  await rejects(
    () => as("guest", () => db.query("select * from private.listing_safety_review_history")),
    "42501",
  );
});
test("old public request overload fails closed and direct private legacy execution is revoked", async () => {
  const f = await fixture();
  await rejects(
    () => as(f.guest, () => scalar("request_booking", [f.id, f.start, "Old form"])),
    "22023",
  );
  await rejects(
    () =>
      as(f.guest, () =>
        db.query("select private.request_booking($1,$2,$3)", [f.id, f.start, "Bypass"]),
      ),
    "42501",
  );
  await rejects(
    () =>
      asRole(db, "anon", null, () =>
        scalar("request_booking", [f.id, f.start, "No auth", participant(f.revision)]),
      ),
    "42501",
  );
  await rejects(() => request(f, participant(f.revision), "unattested"), "42501");
});
test("booking rejects missing acknowledgments, numeric/string coercion and stale revisions before any row is inserted", async () => {
  const f = await fixture();
  for (const [details, code] of [
    [{}, "22023"],
    [participant(f.revision, { adult_booker_confirmed: false }), "22023"],
    [participant(f.revision, { rules_accepted: "true" }), "22023"],
    [participant(f.revision, { age_at_experience: "30" }), "22023"],
    [participant(f.revision, { age_at_experience: 30.5 }), "22023"],
    [participant(f.revision + 1), "40001"],
    [
      participant(f.revision, {
        kind: "minor",
        age_at_experience: 18,
        guardian_authority_confirmed: true,
        guardian_presence_accepted: true,
      }),
      "22023",
    ],
  ])
    await rejects(() => request(f, details), code);
  assert.equal(
    (await db.query("select count(*)::int as n from public.bookings where listing_id=$1", [f.id]))
      .rows[0].n,
    0,
  );
});
test("self and guardian bookings enforce approved age bounds and both guardian acknowledgments", async () => {
  const f = await fixture({
    submission: complete({ min_age: 8, max_age: 17, guardian_presence: "required" }),
  });
  for (const details of [
    participant(f.revision),
    participant(f.revision, {
      kind: "minor",
      age_at_experience: 7,
      guardian_authority_confirmed: true,
      guardian_presence_accepted: true,
    }),
    participant(f.revision, {
      kind: "minor",
      age_at_experience: 12,
      guardian_authority_confirmed: false,
      guardian_presence_accepted: true,
    }),
    participant(f.revision, {
      kind: "minor",
      age_at_experience: 12,
      guardian_authority_confirmed: true,
      guardian_presence_accepted: false,
    }),
  ])
    await rejects(() => request(f, details), "22023");
  // This legacy fixture has capacity one. A required accompanying guardian
  // must occupy a counted seat; acknowledgments alone cannot add that person.
  // The group-booking suite covers a successful reviewed two-person booking.
  await assert.rejects(
    () =>
      request(
        f,
        participant(f.revision, {
          kind: "minor",
          age_at_experience: 12,
          guardian_authority_confirmed: true,
          guardian_presence_accepted: true,
        }),
      ),
    (error) =>
      error.code === "22023" &&
      /Include the accompanying guardian in your guest count/.test(error.message),
  );
  assert.equal(
    (await db.query("select count(*)::int as n from public.bookings where listing_id=$1", [f.id]))
      .rows[0].n,
    0,
  );
});
test("review expiry cannot outlast evidence; slots and requests require clearance through the session end", async () => {
  const f = await fixture({
    publish: false,
    review: false,
    submission: complete({ evidence_expires_on: "2099-12-31" }),
  });
  await as("host", () => scalar("submit_listing_for_review", [f.id]));
  await rejects(
    () =>
      as("admin", () =>
        scalar("admin_review_listing_safety", [
          f.id,
          f.revision,
          "approved",
          "Too long.",
          "2100-01-01T06:00:00Z",
          false,
        ]),
      ),
    "22023",
  );
  const cutoff = new Date(Date.parse(f.start) + 30 * 60000).toISOString();
  await as("admin", () =>
    scalar("admin_review_listing_safety", [
      f.id,
      f.revision,
      "approved",
      "Short valid review.",
      cutoff,
      false,
    ]),
  );
  await act(f.id, "approve_safety");
  await act(f.id, "waive_consultation");
  await act(f.id, "publish");
  assert.equal(
    (
      await asRole(db, "anon", null, () =>
        db.query("select * from public.list_booking_slots($1,$2,$3)", [
          f.id,
          f.start,
          new Date(Date.parse(f.start) + 86400000).toISOString(),
        ]),
      )
    ).rows.length,
    0,
  );
  await rejects(() => request(f), "55000");
});
test("captured rules and age are immutable and readable only by booking participants or administrators", async () => {
  const f = await fixture();
  const id = await request(f);
  for (const who of [f.guest, "host", "admin"])
    assert.equal(
      (await as(who, () => scalar("get_booking_participation", [id]))).age_at_experience,
      30,
    );
  await rejects(() => as("other", () => scalar("get_booking_participation", [id])), "42501");
  await rejects(
    () =>
      db.query(
        "update private.booking_participation set age_at_experience=31 where booking_id=$1",
        [id],
      ),
    "55000",
  );
  await rejects(
    () => db.query("delete from private.booking_participation where booking_id=$1", [id]),
    "55000",
  );
  await rejects(
    () =>
      db.query(
        "update public.bookings set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=$1",
        [id],
      ),
    "55000",
  );
});
test("new pending direct inserts cannot bypass the atomic participation snapshot requirement", async () => {
  const f = await fixture();
  await rejects(
    () =>
      db.query(
        "insert into public.bookings(listing_id,host_id,guest_id,starts_at,ends_at,status,amount_cents) values($1,$2,$3,$4,$5,'requested',10000)",
        [f.id, ids.host, f.guest, f.start, f.end],
      ),
    "22023",
  );
});
test("saving a reviewed activity retracts publication and blocks acceptance without cancelling the existing request", async () => {
  const f = await fixture();
  const id = await request(f);
  const next = await as("host", () =>
    scalar("save_listing_safety_submission", [
      f.id,
      f.revision,
      complete({ hazards: "Changed tools require fresh assessment." }),
    ]),
  );
  assert.equal(next, f.revision + 1);
  assert.equal((await state(f.id)).status, "draft");
  assert.equal(
    await asRole(db, "anon", null, () => scalar("get_listing_participation_rules", [f.id])),
    null,
  );
  await rejects(() => as("host", () => scalar("respond_booking", [id, "accept"])), "55000");
  assert.equal(
    (await db.query("select status from public.bookings where id=$1", [id])).rows[0].status,
    "requested",
  );
  await as(f.guest, () => scalar("cancel_unpaid_booking", [id]));
  assert.equal(
    (await db.query("select status from public.bookings where id=$1", [id])).rows[0].status,
    "cancelled",
  );
});
test("material listing and venue changes invalidate activity approval and preserve the historical review", async () => {
  for (const change of ["listing", "location"]) {
    const f = await fixture();
    if (change === "listing")
      await db.query(
        "update public.listings set description='Materially changed synthetic lesson.' where id=$1",
        [f.id],
      );
    else
      await db.query(
        "update private.listing_locations set address_line1='CHANGED SYNTHETIC VENUE' where listing_id=$1",
        [f.id],
      );
    const current = await as("host", () => scalar("get_listing_safety_submission", [f.id]));
    assert.equal(current.revision, f.revision + 1);
    assert.equal(current.review_status, "pending");
    assert.equal((await state(f.id)).status, "draft");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from private.listing_safety_review_history where listing_id=$1",
          [f.id],
        )
      ).rows[0].n,
      1,
    );
  }
});
test("checkout fails closed after a rule revision, while confirmed legacy booking details remain readable", async () => {
  const f = await fixture();
  const id = await request(f);
  await as("host", () => scalar("respond_booking", [id, "accept"]));
  await as("host", () =>
    scalar("save_listing_safety_submission", [
      f.id,
      f.revision,
      complete({ equipment: "Changed protective equipment." }),
    ]),
  );
  await rejects(
    () =>
      asRole(db, "service_role", null, () =>
        db.query("select private.pay_reserve_checkout($1,$2,$3,$4,$5)", [
          f.guest,
          id,
          "sandbox",
          randomUUID(),
          true,
        ]),
      ),
    "55000",
  );
  // Existing paid records may predate participant attestations. Cancellation and
  // reconciliation must not fabricate missing consent or require new acceptance.
  assert.equal(
    await as(legacy.guest, () => scalar("get_booking_participation", [legacy.booking])),
    null,
  );
  const agreements = (
    await db.query(
      "select guest_legal_acceptance_id,host_legal_acceptance_id from public.bookings where id=$1",
      [legacy.booking],
    )
  ).rows[0];
  assert.deepEqual(agreements, { guest_legal_acceptance_id: null, host_legal_acceptance_id: null });
  // Confirmed cancellations use the established financial path, not this request RPC.
  assert.equal(
    (await as(legacy.guest, () => scalar("get_booking_details", [legacy.booking]))).booking.status,
    "confirmed",
  );
});

test("expired review removes public booking permission without erasing the captured request", async () => {
  const f = await fixture();
  const id = await request(f);
  await db.query(
    "update private.listing_safety_submissions set valid_until = now() - interval '1 second' where listing_id = $1",
    [f.id],
  );
  assert.equal(
    await asRole(db, "anon", null, () => scalar("get_listing_participation_rules", [f.id])),
    null,
  );
  await rejects(() => as("host", () => scalar("respond_booking", [id, "accept"])), "55000");
  assert.equal(
    (await as(f.guest, () => scalar("get_booking_participation", [id]))).rules_snapshot.revision,
    f.revision,
  );
  await as(f.guest, () => scalar("cancel_unpaid_booking", [id]));
});

test("an approved alternative supervision plan still needs the guardian to accept it for a minor", async () => {
  const f = await fixture({
    submission: complete({ min_age: 10, max_age: 17, guardian_presence: "not_required" }),
    guardianOverride: true,
  });
  await rejects(
    () =>
      request(
        f,
        participant(f.revision, {
          kind: "minor",
          age_at_experience: 12,
          guardian_authority_confirmed: true,
          guardian_presence_accepted: false,
        }),
      ),
    "22023",
  );
  const id = await request(
    f,
    participant(f.revision, {
      kind: "minor",
      age_at_experience: 12,
      guardian_authority_confirmed: true,
      guardian_presence_accepted: true,
    }),
  );
  assert.equal(
    (await as(f.guest, () => scalar("get_booking_participation", [id]))).rules_snapshot
      .guardian_presence,
    "not_required",
  );
});

test("publication cannot be created in a raw insert and an infinite review expiry is not accepted", async () => {
  await rejects(
    () =>
      db.query(
        "insert into public.listings(host_id,title,category,price_cents,duration_minutes,city,status,safety_status,consultation_status,published_at) values($1,'Unreviewed direct listing','art',10000,60,'Miami','published','approved','waived',now())",
        [ids.host],
      ),
    "55000",
  );
  const f = await fixture({ publish: false, review: false });
  await as("host", () => scalar("submit_listing_for_review", [f.id]));
  await rejects(
    () =>
      as("admin", () =>
        scalar("admin_review_listing_safety", [
          f.id,
          f.revision,
          "approved",
          "Synthetic indefinite review.",
          "infinity",
          false,
        ]),
      ),
    "22023",
  );
});

test("existing Stripe account access is preserved for an unattested legacy host but new account reservations are blocked", async () => {
  await db.query("update public.profiles set is_host = true where id = $1", [ids.unattested]);
  const prepare = (environment) =>
    asRole(db, "service_role", null, () =>
      db.query("select private.pay_prepare_account($1, $2) as result", [
        ids.unattested,
        environment,
      ]),
    );
  await rejects(() => prepare("live"), "42501");
  await db.query("insert into private.stripe_accounts(host_id,environment) values($1,'sandbox')", [
    ids.unattested,
  ]);
  await rejects(() => prepare("sandbox"), "42501");
  await db.query(
    "update private.stripe_accounts set account_id='acct_synthetic_existing' where host_id=$1 and environment='sandbox'",
    [ids.unattested],
  );
  assert.equal((await prepare("sandbox")).rows[0].result.account_id, "acct_synthetic_existing");
  assert.equal((await as("unattested", () => scalar("get_account_eligibility"))).eligible, false);
});
