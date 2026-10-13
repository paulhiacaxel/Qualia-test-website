/** The exact guarded cap-only script, executed only in isolated PostgreSQL. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  createTestDatabase,
  asRole,
  attestFixtureAdult,
  acceptFixtureLegal,
} from "../database/helpers.mjs";
import { policy as rehearsalPolicy } from "../../scripts/rehearsal/fixtures.mjs";

const script = await readFile(
  new URL("../../scripts/update-founding-cohort-30.sql", import.meta.url),
  "utf8",
);
const originalActivation = await readFile(
  new URL("../../scripts/activate-live-commercial-2026-10-13.sql", import.meta.url),
  "utf8",
);
const launchDecisions = await readFile(
  new URL("../../docs/launch-decisions-proposed.md", import.meta.url),
  "utf8",
);
const originalSandbox = JSON.parse(launchDecisions.match(/```json\n([\s\S]*?)\n```/)[1]).p_settings;
const operator = "033c5f79-f66a-49e5-90e9-dc6a7864d7f9";
const rehearsalOperator = "4b1e5621-0993-4c04-8ddf-99d69023f9f5";
const sources = [
  {
    target: "production",
    environment: "live",
    id: "a2471d8d-9f80-40b0-8bbf-5f42b2ca8188",
    version: "qualia_host_2026_10_13_v1",
    next: "qualia_host_2026_10_13_v2",
    operator,
    created: "2026-10-13 02:52:04.720705+00",
    cancellation: originalActivation.match(/cancellation text := '([^']+)';/)[1],
    hash: "782f68d8853adc7b6f7f0787914e7d48",
  },
  {
    target: "production",
    environment: "sandbox",
    id: "09c510e0-1c08-40c7-a33a-0c5981138271",
    version: "sandbox-2026-10-12-v1",
    next: "sandbox-2026-10-13-cap30-v2",
    operator,
    created: "2026-10-12 16:42:07.443815+00",
    cancellation: originalSandbox.cancellation_terms,
    hash: "a34eca13efc64a98aaec423c527c7b43",
  },
  {
    target: "rehearsal",
    environment: "sandbox",
    id: "047161b1-c46f-4cfe-bf9a-f2cab619bc71",
    version: "local-rehearsal-only-v1",
    next: "local-rehearsal-only-cap30-v2",
    operator: rehearsalOperator,
    created: "2026-10-12 22:52:03.686311+00",
    cancellation: rehearsalPolicy.cancellation_terms,
    hash: "fa604e95335fdda8a9cd2bf1bd1680bb",
  },
];
for (const source of sources)
  assert.equal(createHash("md5").update(source.cancellation).digest("hex"), source.hash);

async function setup(target = "production") {
  const db = await createTestDatabase();
  const selected = sources.filter((source) => source.target === target);
  const host = selected[0].operator;
  const guest = randomUUID();
  for (const user of [host, guest]) {
    await db.query("insert into auth.users(id,email_confirmed_at) values($1,now())", [user]);
    await attestFixtureAdult(db, user);
    await acceptFixtureLegal(db, user, { host: user === host });
  }
  await asRole(db, "authenticated", host, async () => {
    await db.query("select public.enable_host_mode()");
    await db.query(
      "select public.save_host_profile('Synthetic host','Historical configuration fixture.','Miami',null)",
    );
  });
  for (const source of selected) {
    await db.query(
      `insert into private.commercial_policies(id,environment,standard_fee_bps,founder_fee_bps,
      founder_free_bookings,founder_duration_months,founder_cohort_cap,processing_allocation,
      payout_delay_hours,restore_refunded_credit,referral_free_bookings,referral_credit_cap,
      terms_version,cancellation_terms,approved_by,created_at)
      values($1,$2,1750,1250,3,3,40,'host_actual_cost',48,true,1,2,$3,$4,$5,$6)`,
      [
        source.id,
        source.environment,
        source.version,
        source.cancellation,
        source.operator,
        source.created,
      ],
    );
    await db.query(
      "insert into private.commercial_settings(environment,policy_id,enabled) values($1,$2,$3)",
      [source.environment, source.id, source.environment === "live" || target === "rehearsal"],
    );
  }
  // Genuine synthetic historical records prove the cap edit cannot rewrite them.
  const source = selected[0];
  await db.query(
    `insert into private.host_incentive_terms(host_id,environment,policy_id,lifetime_fee_bps,
    starts_at,ends_at,restore_refunded_credit,approved_by,free_booking_limit,duration_months)
    values($1,$2,$3,1250,'2026-01-01','2026-04-01',true,$1,3,3)`,
    [host, source.environment, source.id],
  );
  const listing = randomUUID(),
    booking = randomUUID();
  await db.query(
    `insert into public.listings(id,host_id,title,description,category,price_cents,duration_minutes,city,status)
    values($1,$2,'Synthetic historical lesson','Private historical record for cap-only configuration tests.','art',10000,60,'Miami','draft')`,
    [listing, host],
  );
  await db.query(
    `insert into public.bookings(id,listing_id,host_id,guest_id,starts_at,ends_at,status,amount_cents)
    values($1,$2,$3,$4,'2026-01-02 12:00+00','2026-01-02 13:00+00','cancelled',10000)`,
    [booking, listing, host, guest],
  );
  await db.query(
    `insert into private.payment_attempts(booking_id,environment,guest_id,host_id,account_id,amount_cents,currency,
    commission_bps,commission_cents,policy_id,state,terms_accepted_at,expires_at)
    values($1,$2,$3,$4,'acct_synthetic',10000,'usd',1250,1250,$5,'expired','2026-01-01','2026-01-02')`,
    [booking, source.environment, guest, host, source.id],
  );
  return db;
}
async function snapshot(db) {
  const tables = [
    "private.commercial_policies",
    "private.commercial_settings",
    "private.host_incentive_terms",
    "private.legal_acceptances",
    "public.bookings",
    "private.payment_attempts",
    "private.booking_policy",
    "private.booking_policy_history",
  ];
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [
        table,
        (
          await db.query(
            `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as rows from ${table} t`,
          )
        ).rows[0].rows,
      ]),
    ),
  );
}
async function unchangedOnFailure(db, error) {
  const before = await snapshot(db);
  await assert.rejects(() => db.exec(script), error);
  await db.exec("rollback");
  assert.deepEqual(await snapshot(db), before);
}
for (const target of ["production", "rehearsal"])
  test(`${target}: copy policies with only cap/version changes; preserve enabled flags and historical records`, async () => {
    const db = await setup(target);
    try {
      const before = await snapshot(db);
      await db.exec(script);
      const after = await snapshot(db);
      const originalPolicies = before["private.commercial_policies"];
      assert.equal(after["private.commercial_policies"].length, originalPolicies.length * 2);
      for (const original of originalPolicies) {
        const expected = sources.find((source) => source.id === original.id);
        assert.deepEqual(
          after["private.commercial_policies"].find((row) => row.id === original.id),
          original,
        );
        const copy = after["private.commercial_policies"].find(
          (row) => row.terms_version === expected.next,
        );
        assert.notEqual(copy.id, original.id);
        assert.notEqual(copy.created_at, original.created_at);
        assert.deepEqual(
          {
            ...copy,
            id: original.id,
            created_at: original.created_at,
            terms_version: original.terms_version,
            founder_cohort_cap: 40,
          },
          original,
        );
        const previousSettings = before["private.commercial_settings"].find(
          (row) => row.environment === original.environment,
        );
        const nextSettings = after["private.commercial_settings"].find(
          (row) => row.environment === original.environment,
        );
        assert.deepEqual(nextSettings, { ...previousSettings, policy_id: copy.id });
      }
      for (const table of Object.keys(before).filter(
        (table) => !table.startsWith("private.commercial_"),
      ))
        assert.deepEqual(after[table], before[table]);
      await db.exec(script);
      assert.deepEqual(await snapshot(db), after);
      // Pausing after release must survive a repeat invocation too.
      await db.exec("update private.commercial_settings set enabled=false");
      const paused = await snapshot(db);
      await db.exec(script);
      assert.deepEqual(await snapshot(db), paused);
    } finally {
      await db.close();
    }
  });

test("changed source economics or cancellation content rejects the entire two-environment transaction", async () => {
  const db = await setup();
  try {
    await db.query("update private.commercial_policies set founder_fee_bps=1000 where id=$1", [
      sources[1].id,
    ]);
    await unchangedOnFailure(db, /no longer matches/);
    await db.query(
      "update private.commercial_policies set founder_fee_bps=1250,cancellation_terms='Different cancellation policy' where id=$1",
      [sources[1].id],
    );
    await unchangedOnFailure(db, /no longer matches/);
  } finally {
    await db.close();
  }
});

test("unknown current pointer and unexpected environment reject instead of overriding newer configuration", async () => {
  const db = await setup("rehearsal");
  try {
    await db.exec("update private.commercial_settings set enabled=false,policy_id=null");
    await unchangedOnFailure(db, /later or unknown policy/);
    await db.query("update private.commercial_settings set policy_id=$1", [sources[2].id]);
    await db.exec(
      "insert into private.commercial_settings(environment,enabled) values('live',false)",
    );
    await unchangedOnFailure(db, /Unexpected commercial settings/);
  } finally {
    await db.close();
  }
});

test("replacement drift or duplicate replacement versions fail without rewriting history", async () => {
  const db = await setup("rehearsal");
  try {
    await db.exec(script);
    await db.query(
      "update private.commercial_policies set founder_free_bookings=2 where terms_version=$1",
      [sources[2].next],
    );
    await unchangedOnFailure(db, /differs from the approved cap-only copy/);
    await db.query(
      "update private.commercial_policies set founder_free_bookings=3 where terms_version=$1",
      [sources[2].next],
    );
    await db.exec(`insert into private.commercial_policies select r.* from private.commercial_policies p,
      lateral jsonb_populate_record(null::private.commercial_policies,to_jsonb(p)||jsonb_build_object('id',gen_random_uuid())) r
      where p.terms_version='local-rehearsal-only-cap30-v2'`);
    await unchangedOnFailure(db, /Duplicate replacement policy versions/);
  } finally {
    await db.close();
  }
});

test("31 existing founders fail closed rather than invalidating previously agreed enrollments", async () => {
  const db = await setup("rehearsal");
  try {
    await db.exec(`with new_users as (
      insert into auth.users(id,email_confirmed_at) select gen_random_uuid(),now() from generate_series(1,30) returning id
    ) select count(*) from new_users`);
    await db.query(
      `insert into private.host_incentive_terms(host_id,environment,policy_id,lifetime_fee_bps,
      starts_at,ends_at,restore_refunded_credit,approved_by,free_booking_limit,duration_months)
      select p.id,'sandbox',$1,1250,'2026-01-01','2026-04-01',true,$2,3,3 from public.profiles p
      where p.id<>$2 and not exists(select 1 from private.legal_acceptances a where a.user_id=p.id)`,
      [sources[2].id, rehearsalOperator],
    );
    assert.equal(
      (await db.query("select count(*)::int as n from private.host_incentive_terms")).rows[0].n,
      31,
    );
    await unchangedOnFailure(db, /More than 30 founders/);
  } finally {
    await db.close();
  }
});
