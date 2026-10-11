import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext, signupSchema, passwordSchema, loginSchema } from "../../lib/auth/validation.ts";
import { getSupabaseConfig, getSiteUrl, authIsConfigured } from "../../lib/supabase/config.ts";

test("post-auth navigation rejects external origins and encoded redirect tricks", () => {
  for (const destination of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "%2f%2fevil.example",
    "/account/dashboard?next=https://evil.example",
    "/auth/callback",
    "javascript:alert(1)",
    ["/admin"],
    null,
  ])
    assert.equal(safeNext(destination), "/account/dashboard");
  assert.equal(safeNext("/host/start"), "/host/start");
  assert.equal(safeNext("/admin"), "/admin"); // The destination still has its own authorization guard.
});

test("signup cannot request an administrator role and requires a strong password", () => {
  const valid = {
    email: "HOST@example.com",
    password: "a-long-passphrase",
    fullName: "Miami Host",
    role: "host",
  };
  assert.equal(signupSchema.parse(valid).email, "host@example.com");
  assert.equal(signupSchema.safeParse({ ...valid, role: "admin" }).success, false);
  assert.equal(signupSchema.safeParse({ ...valid, password: "short" }).success, false);
  assert.equal(signupSchema.safeParse({ ...valid, fullName: " " }).success, false);
});

test("password changes require matching values; login accepts existing passwords", () => {
  assert.equal(
    passwordSchema.safeParse({ password: "a-long-passphrase", confirmPassword: "different" })
      .success,
    false,
  );
  assert.equal(
    passwordSchema.safeParse({
      password: "a-long-passphrase",
      confirmPassword: "a-long-passphrase",
    }).success,
    true,
  );
  assert.equal(
    loginSchema.safeParse({ email: "guest@example.com", password: "legacy" }).success,
    true,
  );
});

test("missing or unsafe connection configuration disables account actions", () => {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ];
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert.equal(authIsConfigured(), false);
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
    process.env.NEXT_PUBLIC_SITE_URL = "https://qualia.example";
    assert.equal(authIsConfigured(), true);
    process.env.NEXT_PUBLIC_SITE_URL = "https://name:password@qualia.example";
    assert.equal(getSiteUrl(), null);
    process.env.NEXT_PUBLIC_SITE_URL = "http://qualia.example";
    assert.equal(getSiteUrl(), null);
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    assert.equal(getSiteUrl(), "http://localhost:3000");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://insecure.example";
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://name:password@project.supabase.co";
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_wrong_key_type";
    assert.equal(getSupabaseConfig(), null);
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
