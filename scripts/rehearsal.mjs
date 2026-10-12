#!/usr/bin/env node
/** Local acceptance operator tool. Never accepts a hosted URL or changes Stripe objects. */
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { parseEnv } from "node:util";
import { readFile, writeFile, mkdir, cp, readdir, lstat, unlink } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  RehearsalError,
  PROJECT,
  SITE,
  localStatus,
  sandboxSettings,
  processEnvironment,
  appEnvironment,
  queryRows,
  assertEvidence,
} from "./rehearsal/guards.mjs";
import { seedSql, markerSql, advanceSql, evidenceSql } from "./rehearsal/fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, ".env.rehearsal-stack");
const secretsFile = path.join(root, ".env.rehearsal");
const stateFile = path.join(directory, "fixture.json");
const cli = path.join(root, "node_modules/.bin/supabase");
const run = promisify(execFile);
const cliEnv = { ...processEnvironment(process.env), SUPABASE_EXPERIMENTAL_STACK: "0" };

async function command(args) {
  try {
    return (
      await run(cli, [...args, "--workdir", directory], {
        cwd: root,
        env: cliEnv,
        maxBuffer: 2 * 1024 * 1024,
      })
    ).stdout;
  } catch {
    // CLI errors can contain connection strings: never forward raw provider/CLI output.
    throw new RehearsalError(
      "Local Supabase command failed. Check the dedicated local stack and migration status; no raw secrets were logged.",
    );
  }
}
async function guardedStatus() {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new RehearsalError("The rehearsal directory must be a real local directory.");
  const config = await readFile(path.join(directory, "supabase/config.toml"), "utf8");
  if (!config.includes(`project_id = "${PROJECT}"`))
    throw new RehearsalError("Unexpected local project identity.");
  return localStatus(JSON.parse(await command(["status", "-o", "json"])));
}
async function sql(text, mutation = false) {
  // A private temporary file avoids SQL in process listings and quotes in shell commands.
  const file = path.join(directory, `query-${randomUUID()}.sql`);
  await writeFile(file, text, { mode: 0o600, flag: "wx" });
  try {
    const raw = await command([
      "db",
      "query",
      "--local",
      "--file",
      file,
      "--agent",
      "yes",
      "--output-format",
      "json",
    ]);
    if (mutation) {
      if (raw.trim() !== "DO")
        throw new RehearsalError(
          "Unexpected mutation result; inspect the isolated fixture before retrying.",
        );
      return;
    }
    return queryRows(raw);
  } finally {
    await unlink(file);
  }
}
async function secrets() {
  const info = await lstat(secretsFile);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0)
    throw new RehearsalError("Use a regular private .env.rehearsal file with permissions 600.");
  const env = parseEnv(await readFile(secretsFile, "utf8"));
  sandboxSettings(env);
  return env;
}
async function providerCheck(env) {
  const expected = sandboxSettings(env);
  const stripe = new Stripe(env.STRIPE_RESTRICTED_KEY, {
    apiVersion: "2026-09-30.endive",
    maxNetworkRetries: 1,
  });
  try {
    const platform = await stripe.accounts.retrieve();
    if (platform.id !== expected.platform) throw new RehearsalError("wrong platform");
    const recipient = await stripe.v2.core.accounts.retrieve(expected.recipient, {
      include: ["configuration.recipient", "requirements"],
    });
    const caps = recipient.configuration?.recipient?.capabilities?.stripe_balance;
    if (
      recipient.livemode !== false ||
      recipient.closed ||
      caps?.stripe_transfers?.status !== "active" ||
      caps?.payouts?.status !== "active"
    )
      throw new RehearsalError("recipient not sandbox-ready");
  } catch {
    throw new RehearsalError(
      "Sandbox platform/recipient verification failed. Check IDs, restricted-key permissions and sandbox recipient capabilities.",
    );
  }
  return expected;
}
async function state() {
  const value = JSON.parse(await readFile(stateFile, "utf8"));
  if (value.status !== "ready" || (await sql(markerSql(value)))[0]?.matches !== 1)
    throw new RehearsalError(
      "The local fixture is incomplete or belongs to another run. Do not reuse it.",
    );
  return value;
}

async function main() {
  const [action, booking, stage] = process.argv.slice(2);
  if (action === "init") {
    // Refuse to overwrite any development stack or saved fixture; no automatic resets.
    await mkdir(directory, { mode: 0o700 });
    await mkdir(path.join(directory, "supabase"));
    const config = (await readFile(path.join(root, "supabase/config.toml"), "utf8"))
      .replace('project_id = "qualia"', `project_id = "${PROJECT}"`)
      .replaceAll("5432", "5532");
    await writeFile(path.join(directory, "supabase/config.toml"), config, {
      flag: "wx",
      mode: 0o600,
    });
    await cp(path.join(root, "supabase/migrations"), path.join(directory, "supabase/migrations"), {
      recursive: true,
    });
    console.log(
      "Created a separate local stack configuration. Follow docs/acceptance-rehearsal.md to start it; no service was started.",
    );
    return;
  }
  if (!["seed", "serve", "advance", "verify"].includes(action))
    throw new RehearsalError(
      "Usage: node scripts/rehearsal.mjs init|seed|serve|advance <booking UUID>|verify <booking UUID> paid|released|refunded",
    );
  const status = await guardedStatus();
  if (action === "seed") {
    const env = await secrets(),
      provider = await providerCheck(env);
    if ((await sql("select count(*)::int as users from auth.users"))[0]?.users !== 0)
      throw new RehearsalError(
        "Seed requires a fresh dedicated local database; existing users will not be changed.",
      );
    const fixture = {
      run: randomUUID(),
      listing: randomUUID(),
      status: "preparing",
      credentials: {},
    };
    await writeFile(stateFile, JSON.stringify(fixture, null, 2), { mode: 0o600, flag: "wx" });
    const client = createClient(status.api, status.secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const role of ["host", "guest"]) {
      const email = `${role}-${fixture.run}@example.test`,
        password = randomBytes(24).toString("base64url");
      const result = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Local rehearsal ${role}` },
      });
      if (result.error || !result.data.user)
        throw new RehearsalError(
          "Local Auth fixture creation failed; inspect/reset only the dedicated stack before retrying.",
        );
      fixture[role] = result.data.user.id;
      fixture.credentials[role] = { email, password };
      await writeFile(stateFile, JSON.stringify(fixture, null, 2), { mode: 0o600 });
    }
    await sql(seedSql(fixture, provider.recipient), true);
    fixture.status = "ready";
    await writeFile(stateFile, JSON.stringify(fixture, null, 2), { mode: 0o600 });
    console.log(
      `Local fixture ready. Open ${SITE}/experiences/${fixture.listing}. Credentials are in .env.rehearsal-stack/fixture.json; never share that file.`,
    );
    return;
  }
  const fixture = await state();
  if (action === "serve") {
    const env = await secrets();
    await providerCheck(env);
    // Next loads dotenv files itself. Refuse other repo dotenv files rather than
    // let a local override accidentally reintroduce a production secret or URL.
    const conflicts = (await readdir(root)).filter((name) =>
      /^\.env(?:\.(?:local|development|development\.local))?$/.test(name),
    );
    if (conflicts.length)
      throw new RehearsalError(
        "Use a clean rehearsal checkout without .env, .env.local or development dotenv overrides.",
      );
    const child = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3000",
      ],
      {
        cwd: root,
        env: appEnvironment(process.env, env, status),
        stdio: "inherit",
      },
    );
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
    });
    return;
  }
  if (action === "advance") {
    await sql(advanceSql(fixture, booking), true);
    console.log(
      "Only that paid local fixture's service dates advanced past its captured release delay. Complete and release using the normal admin UI.",
    );
    return;
  }
  const rows = await sql(evidenceSql(fixture, booking));
  if (rows.length !== 1)
    throw new RehearsalError("Expected exactly one paid attempt for this fixture booking.");
  assertEvidence(rows[0], stage);
  // Evidence includes IDs and cents only: no Checkout URLs, tokens, customer data or keys.
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), stage, ...rows[0] }, null, 2));
}
main().catch((error) => {
  // Only our fixed messages are displayed. Unexpected SDK/filesystem errors may contain secrets.
  console.error(
    error instanceof RehearsalError
      ? error.message
      : "Rehearsal stopped. Review local prerequisites and file permissions; raw error output was suppressed.",
  );
  process.exitCode = 1;
});
