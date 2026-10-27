import assert from "node:assert/strict";
import { test } from "node:test";
import {
  safeNext,
  eligibilityPath,
  signupSchema,
  passwordSchema,
  loginSchema,
} from "../../lib/auth/validation.ts";
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
  assert.equal(
    safeNext("/experiences/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    "/experiences/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.equal(
    safeNext("/bookings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    "/bookings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.equal(safeNext("/experiences/not-an-id"), "/account/dashboard");
  assert.equal(
    safeNext("/bookings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?next=//evil.example"),
    "/account/dashboard",
  );
});

test("payout setup survives sign-in and agreement redirects without allowing URL variants", () => {
  assert.equal(safeNext("/host/payments"), "/host/payments");
  assert.equal(eligibilityPath("/host/payments"), "/account/eligibility?next=%2Fhost%2Fpayments");
  const agreement = "/account/agreements?scope=host&next=%2Fhost%2Fpayments";
  assert.equal(safeNext(agreement), agreement);
  for (const destination of [
    "/host/payments?next=https://evil.example",
    "/host/payments/../admin",
    "//host/payments",
    "https://bookqualia.com/host/payments",
  ])
    assert.equal(safeNext(destination), "/account/dashboard");
});

test("signup cannot request an administrator role and requires a strong password", () => {
  const valid = {
    email: "HOST@example.com",
    password: "a-long-passphrase",
    fullName: "Miami Host",
    role: "host",
    adultConfirmed: "on",
  };
  assert.equal(signupSchema.parse(valid).email, "host@example.com");
  assert.equal(signupSchema.safeParse({ ...valid, role: "admin" }).success, false);
  assert.equal(signupSchema.safeParse({ ...valid, password: "short" }).success, false);
  assert.equal(signupSchema.safeParse({ ...valid, fullName: " " }).success, false);
  for (const adultConfirmed of [undefined, null, "", "off", false, true]) {
    assert.equal(signupSchema.safeParse({ ...valid, adultConfirmed }).success, false);
  }
});

test("adult eligibility preserves only known destinations and cannot nest or escape redirects", () => {
  const experience = "/experiences/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const destination = eligibilityPath(experience);
  assert.equal(safeNext(destination), destination);
  assert.equal(eligibilityPath(destination), destination);
  assert.equal(safeNext("/account/eligibility"), "/account/eligibility");
  for (const next of [
    "https://evil.example",
    "//evil.example",
    "/account/dashboard?next=https://evil.example",
    "/account/eligibility",
    destination,
    "%2f%2fevil.example",
  ])
    assert.equal(
      safeNext(`/account/eligibility?next=${encodeURIComponent(next)}`),
      "/account/dashboard",
    );
  assert.equal(safeNext("/account/eligibility?next=%ZZ"), "/account/dashboard");
  assert.equal(safeNext("/account/eligibility?next=%2Fhost%2Fstart&extra=1"), "/account/dashboard");
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
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiJ9.legacy-jwt.signature";
    assert.equal(getSupabaseConfig(), null);
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
