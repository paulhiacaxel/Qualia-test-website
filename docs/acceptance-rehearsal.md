# Isolated payment acceptance rehearsal

This runner makes the real request → acceptance → hosted Stripe Checkout → signed webhook → refund/release check repeatable without putting synthetic listings on `bookqualia.com`. It uses a separate **local Supabase project**, the unchanged application, and a **dedicated Stripe sandbox**. It never creates Stripe objects itself, enables production settings, sends emails or resets a database. Normal application actions create only sandbox payments/transfers during the operator-led browser steps.

The loopback runner and its SQL are tested offline against all application migrations. This workspace has no Docker runtime, so that local runner has not been exercised end to end. A separately authorized **hosted isolated rehearsal** completed the core Auth/Checkout/webhook/refund/transfer browser round trip on October 12: see [evidence and remaining cases](rehearsal-evidence-2026-10-12.html). Its setup does not change the local-only runner guards below. A green offline test alone is not a provider acceptance result.

## Prerequisites and isolation

- Use a clean local checkout with Node 24, `npm ci`, Docker running, and the repository's Supabase CLI 2.120.0. Do not run two rehearsals on its reserved ports at once.
- Use a separate Stripe sandbox with Connect enabled, a restricted **`rk_test_`** key with the application permissions in [Stripe operations](stripe-operations.md), and an existing **sandbox** recipient whose transfers and payouts capabilities are active. The owner completes any hosted sandbox onboarding; the runner does not accept agreements or invent identity details.
- In that sandbox's Workbench, inspect **both snapshot and thin event destinations**, including disabled entries. Confirm there are **no enabled destinations pointing to production or another installation**. Record the sandbox account ID, inspection date and result in the evidence record below. CLI local forwarding needs no Dashboard destination.
- Do **not** reuse sandbox `acct_1SKPOxDIzwThjgQA`: it now forwards events to the dedicated hosted rehearsal deployment; callbacks to bookqualia.com are disabled. Local fixture IDs would fail reconciliation in the separate hosted database. The runner rejects that ID. For other IDs, `QUALIA_REHEARSAL_ISOLATED_SANDBOX=true` is an operator attestation, **not an automated inspection of remote destinations**. Its provider read verifies the platform ID, recipient access, `livemode=false` and active capabilities only.
- Install/authenticate the Stripe CLI against the dedicated sandbox. Check `stripe listen --help`; never add `--live`. Keep keys out of command arguments, shell history, chat, screenshots and source control.

An already-ready recipient deliberately isolates the financial round trip. This does **not** validate new-host Connect onboarding or changed capabilities. Those require a separately approved HTTPS staging/browser check: Stripe Account Links require HTTPS return/refresh URLs even in a sandbox. Do not weaken the loopback runner or application guards to bypass that requirement.

## Start the separate local stack

From the repository root:

```sh
node scripts/rehearsal.mjs init
npx supabase start --help
npx supabase start --workdir .env.rehearsal-stack
```

`init` copies the current migrations and local configuration into the ignored, private `.env.rehearsal-stack/` directory. The project ID is `qualia-acceptance-rehearsal`; its API/database use ports **55321/55322**, distinct from the regular development stack. Supabase's first start applies the copied migrations. CLI startup displays **local** credentials; do not share its output. The runner subsequently captures status without printing keys and refuses hosted endpoints, the normal development ports, legacy keys or an unexpected project identity. It always invokes database commands with `--local` and its fixed work directory.

Do not put hosted Supabase keys in this setup. The runner obtains the modern local publishable/secret keys directly from the local CLI. Auth fixture creation is confirmed through the local Admin API, without a confirmation send; the local SMTP service also captures rather than delivers Auth mail.

Create `.env.rehearsal` in a local editor, restrict its permissions with `chmod 600 .env.rehearsal`, and fill these values from the **dedicated sandbox**:

```dotenv
QUALIA_REHEARSAL_ISOLATED_SANDBOX=true
QUALIA_REHEARSAL_STRIPE_PLATFORM_ID=acct_yourDedicatedSandbox
QUALIA_REHEARSAL_STRIPE_RECIPIENT_ID=acct_yourSandboxRecipient
STRIPE_RESTRICTED_KEY=rk_test_replaceLocally
STRIPE_ENVIRONMENT=sandbox
STRIPE_LIVE_ONBOARDING_ENABLED=false
STRIPE_LIVE_PAYMENTS_ENABLED=false
TRANSACTIONAL_EMAIL_ENABLED=false
STRIPE_WEBHOOK_SECRET_PLATFORM=whsec_replaceLocally
STRIPE_WEBHOOK_SECRET_CONNECT=whsec_replaceLocally
STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2=whsec_replaceLocally
```

Start the local listener in a second terminal, using its already authenticated sandbox context:

```sh
stripe listen \
  --forward-to http://localhost:3000/api/stripe/webhooks \
  --forward-connect-to http://localhost:3000/api/stripe/webhooks/connect \
  --thin-events 'v2.core.account[configuration.recipient].capability_status_updated,v2.core.account[configuration.recipient].updated,v2.core.account[requirements].updated,v2.core.account.closed' \
  --forward-thin-to http://localhost:3000/api/stripe/webhooks/accounts-v2
```

Use the listener's reported signing secret for its corresponding local routes; a single CLI listener can supply the same local session secret to all three. Separate Dashboard destinations retain their **separate** secrets. Check the listener's reported snapshot API version matches the application's `2026-09-30.endive`; configure that dedicated sandbox's default version if necessary. Do not use `--latest` as a substitute for verifying the exact version. Keep the listener running throughout the rehearsal and inspect HTTP delivery results without publishing payloads or tokens.

```sh
node scripts/rehearsal.mjs seed
node scripts/rehearsal.mjs serve
```

`seed` refuses an existing marketplace, creates exactly two local verified users, grants the synthetic host local administrative access, and creates one clearly labeled local listing with several future slots. It binds the provider-verified sandbox recipient. It enables **local only** 24-hour request/payment windows and a rehearsal policy: 17.5% standard, 12.5% founder, first 3 bookings/3 months, cohort 40, actual processor costs paid by the host, 48-hour release delay and approved referral limits. No host is enrolled into founding terms automatically. Synthetic policy text is not legal approval or production Terms.

Local login emails/passwords are saved in `.env.rehearsal-stack/fixture.json` with mode 600. Open that file privately; do not paste or commit it. The runner prints only the local listing URL. `serve` supplies its own local environment, clears email credentials and both live flags, and refuses normal Next.js dotenv overrides. Use a clean checkout rather than moving your production secrets into this file. A partially failed seed is not automatically retried or reset.

## Exercise the actual application

Use separate browser profiles for the generated guest and host. The host is also the **local-only** operator. Keep the address bar on `http://localhost:3000` except for the Stripe-hosted **sandbox** Checkout page.

1. Guest: log in at `/login`, open the printed listing URL, choose a slot and request it. Host: accept at `/host/calendar`. Confirm the guest sees the payment deadline and captured terms.
2. Guest: review/accept the terms and open Checkout. Use Stripe's published [sandbox test payment details](https://docs.stripe.com/testing), never a real card. First try a documented decline and retry successfully within the same session. Confirm there is one successful charge/attempt, not a new attempt for the retry.
3. Wait for the **real signed event** to confirm the booking. Do not mark a payment paid in SQL, rely on the return URL, or use `stripe trigger checkout.session.completed`: generic trigger fixtures are not this booking's Checkout session. Capture the booking UUID from its URL, then run:

   ```sh
   node scripts/rehearsal.mjs verify BOOKING_UUID paid
   ```

   This checks the exact fixture ownership, test session, canonical amount/currency/processor fee, processed payment event and absence of failed event processing. A missing processor fee requires normal canonical reconciliation and a repeat check, not an invented amount.

4. Before release, confirm `/admin/payments` blocks completion/release while the experience is in the future. Advance **only this paid local fixture's service dates**:

   ```sh
   node scripts/rehearsal.mjs advance BOOKING_UUID
   ```

   The command requires the matching local marker, host/guest/listing, confirmed booking and paid sandbox attempt. It locks the host schedule, preserves duration and records the original dates, placing the fixture before existing bookings/blocks and beyond its **captured** delay. It leaves financial state, payment deadlines, provider timestamps and the 48-hour policy untouched. It refuses a second advancement. It is not a production maintenance command or a simulation of Stripe settlement time.

5. Host/operator: use the normal `/admin/payments` actions to mark the simulated experience complete and release earnings. Refresh/reconcile normally if provider status is pending. Run:

   ```sh
   node scripts/rehearsal.mjs verify BOOKING_UUID released
   ```

   Verify the exact net entitlement, transfer ID/destination and host-visible ledger. A host transfer is distinct from a bank payout; do not label one as the other.

6. In the app, issue a partial refund (for example $20 of the $100 fixture), then the remaining refund. After each completes, run `verify BOOKING_UUID refunded`. The check requires successful refund accounting, no pending operations, and exact host recovery when a transfer exists. Full refund leaves the charge attempt recorded as paid and cancels the booking; both records must remain visible.
7. Repeat on another slot with the refund **before** release, and verify no transfer occurs. For incentive coverage, use the normal local admin commercial page to enroll the synthetic host into the displayed rehearsal terms, then verify the first three credits and the subsequent reduced-rate quote. Record those distinct cases; the basic script does not claim they ran automatically.

Do not clear a quarantine, fabricate a Stripe state or change the delay just to pass. Investigate a mismatch through the existing canonical reconciliation/recovery UI. Existing automated tests cover duplicate/out-of-order events, unknown results and financial holds; provider-level fault/replay cases in [Stripe operations](stripe-operations.md) remain separate acceptance evidence. Confirmation/reminder **outbox creation** can be inspected locally, but email delivery is intentionally disabled and is not established by this rehearsal.

## Evidence and cleanup

Record commit SHA, date/operator, dedicated sandbox ID and destination-isolation inspection, local migration count, listener API version, then each booking/attempt/event/refund/transfer ID with observed cents and result. Save the `verify` output locally; it contains IDs and amounts, never keys, passwords or Checkout URLs. Record missing cases as **not run**, including new-host onboarding, real SMTP delivery and bank-payout behavior unless separately demonstrated. Passing this local check does not turn on live payments or certify legal/business readiness.

Stop the app/listener, then use `npx supabase stop --workdir .env.rehearsal-stack` to stop this stack while retaining evidence/data. Never use `--all`, `--linked`, `--project-ref`, `db push` or a hosted connection string. For a later fresh run, archive the evidence privately and intentionally retire only this dedicated local stack after checking the CLI's current stop/reset help; the runner has no destructive cleanup command. Keep or revoke the dedicated sandbox key according to whether the rehearsal will resume. Do not delete production provider objects.

Focused offline validation:

```sh
node --test tests/rehearsal/*.test.mjs
node --check scripts/rehearsal.mjs
```

The tests execute the exact seed/time-advance SQL against all migrations, exercise request/accept and full refund state transitions, check single-use scoped advancement and release math, and reject unsafe endpoints/keys/environment inheritance. They use synthetic provider facts only inside the offline tests. Docker, Supabase Auth/PostgREST, actual Stripe delivery and the operator's browser remain explicit runtime prerequisites.

References checked October 12, 2026: [Supabase local CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Stripe local listener](https://docs.stripe.com/cli/listen), [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [Connect onboarding](https://docs.stripe.com/connect/marketplace/tasks/onboard).
