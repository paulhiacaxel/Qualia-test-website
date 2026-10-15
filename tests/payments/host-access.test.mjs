import assert from "node:assert/strict";
import { test } from "node:test";
import { hostPaymentAccess, paymentConfig } from "../../lib/payments/config.ts";

const live = { STRIPE_ENVIRONMENT: "live", STRIPE_RESTRICTED_KEY: "rk_live_fixture" };
const sandbox = { STRIPE_ENVIRONMENT: "sandbox", STRIPE_RESTRICTED_KEY: "rk_test_fixture" };

test("live host onboarding can open while guest checkout and new transfers stay paused", async () => {
  const env = { ...live, STRIPE_LIVE_ONBOARDING_ENABLED: "true" };
  const access = await hostPaymentAccess(env);
  assert.equal(access.canOnboard, true);
  assert.equal(access.config.environment, "live");
  assert.equal(paymentConfig(env), null);
  assert.equal(paymentConfig(env, true).live, true);
});

test("checkout activation cannot implicitly open onboarding, and existing live account access survives either pause", async () => {
  for (const flag of [undefined, "false", "TRUE", "1"]) {
    const env = {
      ...live,
      STRIPE_LIVE_ONBOARDING_ENABLED: flag,
      STRIPE_LIVE_PAYMENTS_ENABLED: "true",
    };
    const access = await hostPaymentAccess(env);
    assert.equal(access.config.live, true);
    assert.equal(access.canOnboard, false);
    assert.equal(paymentConfig(env).live, true);
  }
  const paused = await hostPaymentAccess(live);
  assert.equal(paused.config.live, true);
  assert.equal(paused.canOnboard, false);
  assert.equal(paymentConfig(live), null);
});

test("sandbox payout access requires a fresh explicit admin authorization, regardless of live flags", async () => {
  const env = {
    ...sandbox,
    STRIPE_LIVE_ONBOARDING_ENABLED: "true",
    STRIPE_LIVE_PAYMENTS_ENABLED: "true",
  };
  assert.equal(await hostPaymentAccess(env), null);
  for (const result of [false, null, undefined, "true", { is_admin: true }])
    assert.equal(await hostPaymentAccess(env, async () => result), null);
  assert.equal(
    await hostPaymentAccess(env, async () => {
      throw new Error("role lookup unavailable");
    }),
    null,
  );
  let verified = 0;
  const admin = await hostPaymentAccess(env, async () => {
    verified++;
    return true;
  });
  assert.equal(verified, 1);
  assert.equal(admin.config.environment, "sandbox");
  assert.equal(admin.canOnboard, true);
  // Revoking the role must close the next request; no cross-request role cache.
  assert.equal(await hostPaymentAccess(env, async () => false), null);
});

test("invalid credentials and mixed modes cannot be authorized by an admin or a feature flag", async () => {
  for (const env of [
    {},
    { ...live, STRIPE_RESTRICTED_KEY: "rk_test_fixture" },
    { ...sandbox, STRIPE_RESTRICTED_KEY: "rk_live_fixture" },
    { ...live, STRIPE_RESTRICTED_KEY: "sk_live_fixture" },
    { ...live, STRIPE_ENVIRONMENT: "other" },
  ]) {
    let queried = false;
    assert.equal(
      await hostPaymentAccess({ ...env, STRIPE_LIVE_ONBOARDING_ENABLED: "true" }, async () => {
        queried = true;
        return true;
      }),
      null,
    );
    assert.equal(queried, false);
  }
});

test("real host access does not depend on an administrative sandbox role", async () => {
  let queried = false;
  const access = await hostPaymentAccess(
    { ...live, STRIPE_LIVE_ONBOARDING_ENABLED: "true" },
    async () => {
      queried = true;
      return false;
    },
  );
  assert.equal(access.canOnboard, true);
  assert.equal(queried, false);
});
