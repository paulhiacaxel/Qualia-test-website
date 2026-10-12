/** Only the isolated acceptance runner imports these helpers. No production bypasses. */
export const PROJECT = "qualia-acceptance-rehearsal";
export const SITE = "http://localhost:3000";
export const API = "http://127.0.0.1:55321";
export const DB_PORT = "55322";
export const MARKER = "qualia-local-acceptance-v1";
export class RehearsalError extends Error {}
// This sandbox has destinations on bookqualia.com and cannot receive local fixture IDs.
const PUBLIC_APP_SANDBOX = "acct_1SKPOxDIzwThjgQA";

export function uuid(value) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value ?? "")
  )
    throw new RehearsalError("A complete fixture UUID is required.");
  return value;
}
export function accountId(value) {
  if (!/^acct_[A-Za-z0-9]+$/.test(value ?? ""))
    throw new RehearsalError("A Stripe account ID is required.");
  return value;
}
export function sqlString(value) {
  if (typeof value !== "string" || value.includes("\0"))
    throw new RehearsalError("Invalid SQL value.");
  return "'" + value.replaceAll("'", "''") + "'";
}
export function localStatus(input) {
  const s = input.env ?? input;
  const api = new URL(s.API_URL);
  const db = new URL(s.DB_URL);
  if (
    api.origin !== API ||
    api.username ||
    api.password ||
    api.pathname !== "/" ||
    api.search ||
    api.hash ||
    db.protocol !== "postgresql:" ||
    db.hostname !== "127.0.0.1" ||
    db.port !== DB_PORT ||
    db.pathname !== "/postgres" ||
    db.search ||
    db.hash
  )
    throw new RehearsalError(
      "Refusing a database/API outside the dedicated loopback rehearsal ports.",
    );
  if (!s.PUBLISHABLE_KEY?.startsWith("sb_publishable_") || !s.SECRET_KEY?.startsWith("sb_secret_"))
    throw new RehearsalError(
      "Local modern Supabase keys are required; update the local CLI rather than relaxing app guards.",
    );
  return { api: API, publishable: s.PUBLISHABLE_KEY, secret: s.SECRET_KEY };
}
export function sandboxSettings(env) {
  if (
    !/^rk_test_\S+$/.test(env.STRIPE_RESTRICTED_KEY ?? "") ||
    env.STRIPE_ENVIRONMENT !== "sandbox" ||
    env.STRIPE_LIVE_PAYMENTS_ENABLED !== "false" ||
    env.STRIPE_LIVE_ONBOARDING_ENABLED !== "false" ||
    env.TRANSACTIONAL_EMAIL_ENABLED !== "false" ||
    env.QUALIA_REHEARSAL_ISOLATED_SANDBOX !== "true"
  )
    throw new RehearsalError(
      "Explicit isolated sandbox, restricted test key, disabled live flags and disabled email are required.",
    );
  const platform = accountId(env.QUALIA_REHEARSAL_STRIPE_PLATFORM_ID);
  if (platform === PUBLIC_APP_SANDBOX)
    throw new RehearsalError(
      "That sandbox forwards events to the public app. Use a dedicated rehearsal sandbox.",
    );
  const recipient = accountId(env.QUALIA_REHEARSAL_STRIPE_RECIPIENT_ID);
  if (recipient === platform)
    throw new RehearsalError("Choose a sandbox connected recipient, not the platform itself.");
  for (const name of [
    "STRIPE_WEBHOOK_SECRET_PLATFORM",
    "STRIPE_WEBHOOK_SECRET_CONNECT",
    "STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2",
  ])
    if (!/^whsec_\S+$/.test(env[name] ?? ""))
      throw new RehearsalError(`Configure the local listener's ${name}.`);
  return { platform, recipient };
}

/** Do not inherit production provider keys or CLI endpoint/config overrides. */
export function processEnvironment(env) {
  const names = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "SYSTEMROOT",
    "COMSPEC",
  ];
  return Object.fromEntries(
    names.filter((name) => env[name] !== undefined).map((name) => [name, env[name]]),
  );
}
export function appEnvironment(base, secrets, status) {
  sandboxSettings(secrets);
  const names = [
    "STRIPE_RESTRICTED_KEY",
    "STRIPE_WEBHOOK_SECRET_PLATFORM",
    "STRIPE_WEBHOOK_SECRET_CONNECT",
    "STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2",
  ];
  return {
    ...processEnvironment(base),
    ...Object.fromEntries(names.map((name) => [name, secrets[name]])),
    NEXT_PUBLIC_SUPABASE_URL: status.api,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.publishable,
    SUPABASE_SECRET_KEY: status.secret,
    NEXT_PUBLIC_SITE_URL: SITE,
    STRIPE_ENVIRONMENT: "sandbox",
    STRIPE_LIVE_PAYMENTS_ENABLED: "false",
    STRIPE_LIVE_ONBOARDING_ENABLED: "false",
    TRANSACTIONAL_EMAIL_ENABLED: "false",
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    CONTACT_EMAIL: "",
    CRON_SECRET: "",
    NODE_ENV: "development",
  };
}
export function queryRows(raw) {
  const result = JSON.parse(raw);
  if (!Array.isArray(result.rows))
    throw new RehearsalError("Unexpected local CLI query result; refusing to infer success.");
  return result.rows;
}

export function assertEvidence(row, stage) {
  if (!["paid", "released", "refunded"].includes(stage))
    throw new RehearsalError("Choose paid, released or refunded.");
  if (
    !row ||
    row.environment !== "sandbox" ||
    row.state !== "paid" ||
    row.quarantine_reason ||
    !(
      ["confirmed", "completed"].includes(row.booking_status) ||
      (stage === "refunded" &&
        row.booking_status === "cancelled" &&
        row.refund_cents === row.amount_cents)
    ) ||
    !row.session_id?.startsWith("cs_test_") ||
    !row.charge_id ||
    !row.payment_intent_id ||
    row.received_amount_cents !== row.amount_cents ||
    row.received_currency !== "usd" ||
    !Number.isInteger(row.processor_fee_cents) ||
    row.processed_payment_events < 1 ||
    row.failed_events > 0
  )
    throw new RehearsalError(
      "The fixture does not yet have clean, provider-confirmed sandbox payment/webhook evidence.",
    );
  const remaining = row.amount_cents - row.refund_cents;
  const entitlement = Math.max(
    0,
    remaining - Math.floor((remaining * row.commission_bps) / 10000) - row.processor_fee_cents,
  );
  if (
    stage === "released" &&
    (row.booking_status !== "completed" ||
      row.transfer_cents <= 0 ||
      row.pending_operations > 0 ||
      row.transfer_cents - row.reversal_cents !== entitlement)
  )
    throw new RehearsalError(
      "A completed booking and successful transfer with no pending operations are required.",
    );
  if (
    stage === "refunded" &&
    (row.refund_cents <= 0 ||
      row.pending_operations > 0 ||
      row.refund_cents > row.amount_cents ||
      (row.transfer_cents > 0 && row.transfer_cents - row.reversal_cents !== entitlement))
  )
    throw new RehearsalError(
      "A successful refund and any required host recovery must be recorded without pending operations.",
    );
}
