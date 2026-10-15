import assert from "node:assert/strict";
import { test } from "node:test";
import { createTestDatabase, asRole, attestFixtureAdult, acceptFixtureLegal } from "./helpers.mjs";

const admin = "ac000000-0000-4000-8000-000000000001";
const host = "ac000000-0000-4000-8000-000000000002";
const other = "ac000000-0000-4000-8000-000000000003";

test("assisted host draft is private, cannot impersonate consent, and has an explicit owner claim", async () => {
  const db = await createTestDatabase();
  try {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'operator@example.test',now()),($2,'other@example.test',now())",
      [admin, other],
    );
    await db.query(
      "insert into private.admin_memberships(user_id,reason) values($1,'Synthetic operator')",
      [admin],
    );
    const reserve = () =>
      db.query(
        "select public.admin_reserve_assisted_host('test-host','host@example.test') as reserved",
      );
    await assert.rejects(asRole(db, "anon", null, reserve));
    await assert.rejects(asRole(db, "authenticated", other, reserve), /Administrator/);
    assert.equal((await asRole(db, "authenticated", admin, reserve)).rows[0].reserved, true);
    assert.equal((await asRole(db, "authenticated", admin, reserve)).rows[0].reserved, false);
    // Auth API creates this synthetic account; the application never writes Auth SQL.
    await db.query("insert into auth.users(id,email) values($1,'host@example.test')", [host]);
    const profile = {
      display_name: "Test Host",
      bio: "A reviewed biography for a synthetic test only.",
      city: "Miami",
      portfolio_url: "https://example.test",
    };
    const listing = {
      title: "Prepared photo walk",
      description: "A synthetic 90 minute photo walk.",
      category: "photography",
      price_cents: 30000,
      duration_minutes: 90,
      city: "Miami",
      neighborhood: "To confirm",
    };
    const prepare = (id) =>
      db.query("select public.admin_prepare_assisted_listing('test-host',$1,$2,$3) as id", [
        id,
        profile,
        listing,
      ]);
    await assert.rejects(
      asRole(db, "authenticated", admin, () => prepare(other)),
      /does not match/,
    );
    const id = (await asRole(db, "authenticated", admin, () => prepare(host))).rows[0].id;
    assert.equal(
      (await db.query("select is_host from public.profiles where id=$1", [host])).rows[0].is_host,
      false,
    );
    assert.equal(
      (
        await asRole(db, "authenticated", other, () =>
          db.query("select public.get_assisted_host_listing() as value"),
        )
      ).rows[0].value,
      null,
    );
    await assert.rejects(
      asRole(db, "authenticated", host, () =>
        db.query("select public.get_assisted_host_listing()"),
      ),
      /Verify/,
    );
    assert.equal(
      (
        await asRole(db, "anon", null, () =>
          db.query("select id from public.listings where id=$1", [id]),
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("update public.listings set status='submitted' where id=$1", [id]),
      /host must confirm/,
    );
    await db.query("update auth.users set email_confirmed_at=now() where id=$1", [host]);
    const claim = () =>
      db.query(
        "select public.confirm_assisted_host_listing(30000,'private_per_guest',4,true) as id",
      );
    await assert.rejects(asRole(db, "authenticated", host, claim));
    await attestFixtureAdult(db, host);
    await assert.rejects(asRole(db, "authenticated", host, claim), /agreement|terms/i);
    await acceptFixtureLegal(db, host, { host: true });
    await assert.rejects(asRole(db, "authenticated", other, claim));
    await assert.rejects(
      asRole(db, "authenticated", host, () =>
        db.query("select public.confirm_assisted_host_listing(30000,'private_group',4,false)"),
      ),
      /Confirm/,
    );
    assert.equal((await asRole(db, "authenticated", host, claim)).rows[0].id, id);
    let row = (
      await db.query(
        "select status,booking_format,max_guests,private_price_basis from public.listings where id=$1",
        [id],
      )
    ).rows[0];
    assert.deepEqual(row, {
      status: "draft",
      booking_format: "private",
      max_guests: 4,
      private_price_basis: "per_guest",
    });
    // Retrying after a partial photo import does not alter previously confirmed pricing.
    await asRole(db, "authenticated", host, () =>
      db.query("select public.confirm_assisted_host_listing(100,'shared_per_guest',50,true)"),
    );
    assert.equal(
      (await db.query("select price_cents from public.listings where id=$1", [id])).rows[0]
        .price_cents,
      30000,
    );
    await assert.rejects(
      db.query(
        "update public.listings set status='published', safety_status='approved', consultation_status='waived', published_at=now() where id=$1",
        [id],
      ),
    );
    await asRole(db, "authenticated", admin, () =>
      db.query(
        "select public.admin_finish_assisted_invite('test-host','accepted','synthetic-email-id')",
      ),
    );
    await assert.rejects(
      asRole(db, "authenticated", admin, () =>
        db.query(
          "select public.admin_finish_assisted_invite('test-host','accepted','duplicate-id')",
        ),
      ),
      /already recorded/,
    );
  } finally {
    await db.close();
  }
});
