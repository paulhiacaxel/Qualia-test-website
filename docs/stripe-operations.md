# Stripe setup and operating guide

Implementation: stripe-node 23.0.0, API `2026-09-30.endive`, Accounts v2 Express recipient accounts, hosted Checkout, separate charges and transfers. Checkout charges Qualia's platform; the database freezes commission and incentive credits. Qualia releases eligible host earnings manually after verified completion and the approved delay. A host transfer is distinct from a Stripe bank payout.

## Current live configuration — October 12, 2026

The live-onboarding cutover is complete on account `acct_1SKPOXDqyZniopvO`. READY Production deployment `dpl_6xuXGHWTpbzf88UJs9MBu1Ajws9N` serves **https://bookqualia.com** from `codex/qualia-phase-1` commit `cfc45b3de1e95b2c3ab752fc952522af2f4653a9`; build completed at 22:21:43 UTC. This was a configuration redeployment of the existing production source.

- Public details are saved and read back as **Qualia**, **https://bookqualia.com**, **support@bookqualia.com**, descriptor/short descriptor **BOOKQUALIA**, industry **Other educational services**, and an accurate description of the Miami one-on-one educational-experiences marketplace. Actual legal identity, bank and verified payout details were preserved.
- Live Connect Marketplace is configured: buyers purchase from Qualia, Qualia pays Stripe fees and bears negative balance liability, Express dashboard, and Stripe-hosted/embedded onboarding. The platform liability acknowledgement is recorded October 12.
- Dedicated restricted live key **Qualia live app** uses the exact resource grants below and is stored only in Vercel Production Secret `STRIPE_RESTRICTED_KEY`. The old **S Key** was expired; the owner rotated the old primary secret with immediate expiration. Neither old key remains active. The new primary secret is not used by the application. Installed Apps reports no installed apps; the two legacy ChronosLuxe webhooks remain disabled.
- Production is `STRIPE_ENVIRONMENT=live`, `STRIPE_LIVE_ONBOARDING_ENABLED=true`, **`STRIPE_LIVE_PAYMENTS_ENABLED=false`**. All three matching live signing secrets are saved as Production Secrets and loaded by the same deployment. Supabase, email and site-origin settings were preserved.
- Global booking requests remain disabled with 1440/1440-minute deadlines. The sandbox commercial policy remains disabled; no live commercial policy is present. No live charge, transfer, refund or bank payout was initiated during setup.

| Live destination | ID | Source / payload | Production Secret |
| --- | --- | --- | --- |
| `https://bookqualia.com/api/stripe/webhooks` | `we_1UPrRhDqyZniopvOioMbCZCa` | Your account / snapshot | `STRIPE_WEBHOOK_SECRET_PLATFORM` |
| `https://bookqualia.com/api/stripe/webhooks/connect` | `we_1UPrUmDqyZniopvOvezkVg59` | Connected accounts / snapshot | `STRIPE_WEBHOOK_SECRET_CONNECT` |
| `https://bookqualia.com/api/stripe/webhooks/accounts-v2` | `ed_61VZFTJf1faJiPftK16TTnLtSmSQtqtJs4BROqCYi9vc` | Your account / thin | `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2` |

All three live destinations are active. Snapshots use API **2026-09-30.endive**; thin notifications are unversioned. The documented 15 platform events were selected in the editor. Stripe's overview additionally displays `transfer.canceled` (16 total), although the selection editor shows 15; the application ignores unsupported events. Connect has the exact six payout events, and Accounts v2 the exact four account events below.

**Verification:** all three deployed routes return HTTP 400 for both missing and invalid signatures. Stripe's live `v2.core.event_destination.ping` (`evt_65VZFZkup83siIyN6XX16TTnLtSmSQtqtJs4BROqCYiUBs`) delivered with HTTP 200 and `{"received":true}`. The owner completed actual live host onboarding. App **Refresh status** succeeded for `acct_1UPrcuRWrbZzYTAS` at **2026-10-12T22:25:53.610781Z**: transfers active, payouts active, no currently-due requirements. The sandbox mapping `acct_1UPmYYDIzwhiF46n` remains separate. All six live account events and all 12 sandbox inbox events were processed at the checkpoint. The new deployment's error/fatal log scan was clean.

Before cutover, the database had zero bookings, payment attempts and settlement operations, with all sandbox inbox records processed. The three active sandbox destinations targeting bookqualia.com were reversibly disabled and retained; the two earlier incorrect sandbox destinations remain disabled. See their IDs below. Keep prior READY deployment `dpl_5Vtuk2kMNUzGQgGxNb4KJBaSobAB` as a recovery reference, but **do not restore its sandbox configuration now that a real live host exists**. To pause onboarding, set only `STRIPE_LIVE_ONBOARDING_ENABLED=false` and redeploy compatible code while retaining live credentials and live webhook reconciliation.

Full sandbox Checkout/refund/release acceptance and remaining owner legal/commercial launch decisions are still required before enabling real guest payments or new transfers. Successful onboarding is not a completed financial acceptance rehearsal.

## Isolated hosted rehearsal — preparation checkpoint

The owner approved using the existing organization and explicitly approved transferring the test-only Stripe/Supabase credentials and rehearsal signing secrets to the isolated Vercel project. Supabase `ibkpptqfdjtkybquxzgk` (**Qualia payment rehearsal**) is in existing organization `tmpohknifidnouqaukkq`, with all 12 application migrations applied, plus a private rehearsal-fixture schema. Vercel **qualia-payment-rehearsal**, project `prj_HmoejlICbeTjEwF60Ymky3FGGDuI`, is in existing team **Qualia / qualia4** and tracks `codex/qualia-phase-1`. Its allocated test origin is `https://project-6v35u.vercel.app`; the Vercel environment label Production belongs only to this separate test project.

Two synthetic confirmed Auth users and one clearly labeled $100 art listing are seeded only in the test database, with an isolated operator role and approved-value sandbox policy. Stripe runtime-key read verified platform `acct_1SKPOxDIzwThjgQA` and recipient `acct_1UPmYYDIzwhiF46n`, `livemode=false`, transfers/payouts active. All 175 automated tests passed on Node 24.21.0. The database advisor returned only informational notices for private RLS tables intentionally accessed through authorized functions, not client policies.

Test deployment/webhook wiring and the actual hosted Checkout/refund/release rehearsal are still in progress at this checkpoint. Do not claim financial acceptance from fixture creation or offline tests. Email sends and both live flags are false in this separate project. Production `bookqualia.com` remains live onboarding only. The existing loopback runner and its guards are unchanged; do not point it at this hosted database. Retained sandbox callbacks to bookqualia.com remain disabled.

## Owner scope update — October 12, 2026

The owner wants guest payments active after the material launch checks are complete. **Minors and higher-risk activities are included**; hosts propose age limits and safeguards, and Qualia decides the approved range during listing review. Some listings may be 18+. There is no approved blanket adults-only pilot or category exclusion. Use the existing Qualia organization for rehearsal resources. The owner requested drafts and identification of remaining approvals; final legal wording and the proposed adult-account/guardian-booker model are not yet approved.

See [launch drafts and approval packet](launch-legal-drafts.html). It contains proposed guest terms, host commercial terms, cancellation policy, privacy notice, guardian-document brief and listing review fields. These are drafts, not published website terms. Previously approved numerical commercial decisions remain settled.

## Retained sandbox configuration — October 12, 2026

The sandbox is `acct_1SKPOxDIzwThjgQA`, with `livemode=false` and **Connect Marketplace enabled**. After renewed browser approval, the earlier SMS attempt was found to have succeeded despite the authentication tool's failure report. The configuration below records the completed sandbox setup before the live cutover. These destinations are now retained but disabled for the production origin.

Dedicated restricted key **Qualia sandbox app** (`mk_1UPkb4DIzwThjgQARHnBkBjC`) is retained in Stripe. Historical READY deployment `dpl_DmSfo2PvjQG2s72b8HCSHUgkx24N` loaded it and the three sandbox signing secrets at reviewed commit `471dc55fd6029940b333d4a5813668c93b1f797f`. Current Production uses the live key and secrets above. Secret values remain outside the repository.

| Destination                            | ID                                                     | Verified state                                                                       |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Platform snapshots                     | `we_1UPjZeDIzwThjgQAclqYI3H5`                          | Disabled at live cutover; retained platform snapshot destination               |
| Corrected Connect payout snapshots     | `we_1UPkTKDIzwThjgQAIQtjmXFc`                          | Disabled at live cutover; retained `@accounts` / snapshot    |
| Accounts v2 thin events                | `ed_test_61VZ7YBgatG2p8hK916TTnMJSmSQozILacixY42JEPZY` | Disabled at live cutover; retained Your account / thin |
| Incorrect original payout destination  | `we_1UPjaKDIzwThjgQAinUcI1AR`                          | Disabled, `@self` / snapshot                                                         |
| Incorrect duplicate payout destination | `we_1UPjeCDIzwThjgQAzDVeQRVx`                          | Disabled, `@self` / snapshot                                                         |

Dashboard inspection confirmed both earlier payout destinations had **Your account** scope. The supported update APIs cannot change this source: [V2 event-destination update](https://docs.stripe.com/api/v2/core/event_destinations/update) states event scopes are configured at creation, and [V1 webhook update](https://docs.stripe.com/api/webhook_endpoints/update) has no `connect` parameter. After enabling sandbox Connect, the replacement was created with **Connected accounts / Snapshot**, API version `2026-09-30.endive`, the six payout events below and the existing Connect URL. Both incorrect destinations were then reversibly disabled. Pre-cutover V1 and V2 API read-back confirmed the replacement source is `@accounts`; it was disabled with the other sandbox destinations during the live cutover.

The initial runtime-key Accounts v2 read failed with HTTP 403 until the separate **Accounts v2: Read** and **Recipient Configuration: Write** grants were added. The key value was unchanged, so no further redeploy was needed. With API version `2026-09-30.endive`, the pre-cutover sandbox runtime-key reads returned HTTP 200 and empty lists for `/v2/core/accounts?limit=1` (`req_v2qvgDoH9T9OBTzgq`) and `/v1/checkout/sessions?limit=1` (`req_R0Dbk4rOqnXYYz`). All three deployed webhook routes reject missing and invalid signatures with HTTP 400. These are configuration and negative checks, not a completed payment/webhook rehearsal: no account, checkout payment, refund, transfer or payout was created by these checks. Full sandbox acceptance remains pending approved fixtures and explicit commercial/booking policies.

## Before sandbox use

Use a separately configured staging deployment for further sandbox acceptance. Production `https://bookqualia.com` now serves live host onboarding; do not overwrite its live credentials, flags or secrets or re-enable sandbox deliveries to it. The steps below are for the isolated sandbox deployment, using its exact staging origin.

1. In the [Stripe Dashboard](https://dashboard.stripe.com/), select the existing sandbox identified above and check that the sandbox banner is visible. Sandbox access is verified through the connected tools; there is no need to create another one.
2. The existing sandbox's Connect Marketplace setup is complete. For another sandbox, complete Connect setup if Stripe requests it. The integration is a marketplace: Qualia collects the guest payment, hosts use an Express dashboard, Qualia manages pricing and negative balance liability, and separate charges/transfers support release after completion. The owner supplies business facts and accepts any required agreements; do not invent or pre-accept these.
3. The existing sandbox key is **Qualia sandbox app**. Do not create a duplicate. Its persisted Dashboard grants are recorded below. For another environment, start with no permissions and grant only the resources required. Write includes Read. The connected-account column appeared after Connect Marketplace was enabled in this sandbox.

### Restricted runtime key permissions

| Dashboard resource                                         | Platform permission | Connected-account permission         |
| ---------------------------------------------------------- | ------------------- | ------------------------------------ |
| Balance                                                    | Read                | None                                 |
| Charges and Refunds (grouped)                              | Write               | None                                 |
| Payment Disputes                                           | Read                | None                                 |
| Payment Intents                                            | Read                | None                                 |
| Checkout Sessions                                          | Write               | None                                 |
| Accounts (V1)                                              | Write               | None                                 |
| Account Links                                              | Write               | None                                 |
| Login Links                                                | Write               | None                                 |
| Transfers                                                  | Write               | None                                 |
| Accounts v2                                                | Read                | Mirrored by Stripe; disabled control |
| Recipient Configuration                                    | Write               | Mirrored by Stripe; disabled control |
| Payouts                                                    | None                | Read                                 |
| Other resources, including Customer/Merchant Configuration | None                | None                                 |

The V2 connected-account cells are gray and automatically mirror the selected platform grants; they cannot be controlled independently in this UI. Charges and Refunds is a grouped Write grant because refunds are created; the code only reads Charges. Accounts (V1) Write remains in the verified saved configuration; its necessity for Express login links has not been conclusively isolated. Do not describe untested grants as fully proven.
The current code does not retrieve Events through the API and does not need an Events permission. A publishable Stripe key is not needed for the hosted Checkout redirect. Verify the restricted key against actual sandbox requests and use Workbench permission errors to identify a missing resource grant; do not replace it with unrestricted access.

4. Copy the `rk_test_` value directly into the selected Vercel project's **Settings → Environment Variables**, using a **Sensitive** variable. Never paste keys into chat, source files, logs or browser configuration. Set these deployment variables:

- `STRIPE_ENVIRONMENT=sandbox`
- `STRIPE_RESTRICTED_KEY=rk_test_...`
- `STRIPE_WEBHOOK_SECRET_PLATFORM=whsec_...`
- `STRIPE_WEBHOOK_SECRET_CONNECT=whsec_...`
- `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2=whsec_...`
- `STRIPE_LIVE_ONBOARDING_ENABLED=false`
- `STRIPE_LIVE_PAYMENTS_ENABLED=false`
- `SUPABASE_SECRET_KEY` and the existing public Supabase URL/publishable key
- `NEXT_PUBLIC_SITE_URL` set to the separately configured exact staging origin; keep Production at `https://bookqualia.com` with its live configuration

Do not use a real live account as a sandbox. This repository does not provision an account or accept platform/host legal agreements. Owners complete Stripe's platform business verification and Connect setup themselves. Host onboarding collects identity and business information in Stripe's hosted forms, without inferring an entity type or accepting terms for them.

The owner approved and saved a **sandbox** commercial policy at `/admin/commercial`, verified disabled as `09c510e0-1c08-40c7-a33a-0c5981138271` (`sandbox-2026-10-12-v1`). It records: rates, founding free-booking count/calendar-month duration/cohort cap, processing allocation, release delay, cancellation wording/version, refund restoration and referral grant/cap. See the approved [launch decisions](launch-decisions-proposed.md); the historical offer is not an active policy. The configurable-incentive migration is applied to hosted Supabase; the corresponding application is deployed at `471dc55`. Enrollment requires a verified host with a published listing and consent to the displayed policy version; it freezes the agreed start, count, window, rate and restoration rule. Existing quotes keep their policy, and guests accept displayed cancellation terms before Checkout. The saved policy remains disabled; enable only for the authorized sandbox rehearsal. Complete owner-approved Terms, Privacy and host agreements remain launch prerequisites.

## Live host onboarding

The deployed application separates `STRIPE_LIVE_ONBOARDING_ENABLED` from `STRIPE_LIVE_PAYMENTS_ENABLED`. The onboarding flag defaults to **false** and must be explicitly set to `true` only after the intended Qualia live account, restricted key and live webhook destinations are configured. With that flag enabled, verified hosts can create or resume live Connect onboarding while guest checkout and new transfers remain paused. Existing live payout status and dashboard access remain available during either pause. Completing Stripe setup neither publishes a listing nor enables guest payments.

Sandbox payout pages and actions are restricted to verified administrators using the current server-side `is_admin` check. Public hosts can still sign up, complete their profiles and submit listings; they are not directed into sandbox payout setup. Do not grant an administrative role merely to let a prospective host test payments.

**Live-account reuse authorized:** on October 12 the owner explicitly allowed retiring ChronosLuxe and repurposing account `acct_1SKPOXDqyZniopvO` (Axel Paulhiac) for Qualia. Fresh reads found no charges, subscriptions (all statuses), connected accounts, available balance or pending balance. The two old ChronosLuxe payment/identity webhook destinations were reversibly disabled and their disabled state read back. Do not delete the account, change its bank or alter its legal identity to perform this migration.

**Owner identity verification cleared:** the fresh account read at **2026-10-12T20:06:30.842Z** reported the individual verified, empty `currently_due`, `past_due` and `pending_verification`, `disabled_reason=null`, and both charges and payouts enabled. This supersedes the earlier outstanding `individual.verification.proof_of_liveness` requirement. It does not establish completion of the application's payment acceptance checks.

The live account's previously verified brand settings are cream **#faf6ee**, moss **#37503b**, and **Inter** for Checkout. Icon and logo remain null; neither was uploaded. Public business details, Connect, key retirement and the coordinated live deployment are completed as recorded in [Current live configuration](#current-live-configuration--october-12-2026). Actual legal identity and verified payout details were preserved. The sandbox remains accessible for isolated testing; its credentials and connected accounts cannot be reused as live resources.

### Live-onboarding cutover checklist — completed October 12

1. Finish the Qualia public details, verify live Connect Marketplace setup and finish any remaining steps, then prepare a dedicated restricted **`rk_live_`** key with the resource permissions above. Verify the key belongs to `acct_1SKPOXDqyZniopvO`; preserve its actual legal identity and bank. Public-profile, Connect and key setup currently require the Dashboard.
2. The completed cutover created the three **live** destinations below with the exact event lists in [Webhook destinations](#webhook-destinations), using snapshot API version **2026-09-30.endive**. Store each signing secret directly in the matching Vercel Production Secret variable. All three were created, their secrets stored, and the coordinated deployment verified at the checkpoint above.

   | Live URL                                                 | Source / payload              | Production Secret                   |
   | -------------------------------------------------------- | ----------------------------- | ----------------------------------- |
   | `https://bookqualia.com/api/stripe/webhooks`             | Your account / snapshot       | `STRIPE_WEBHOOK_SECRET_PLATFORM`    |
   | `https://bookqualia.com/api/stripe/webhooks/connect`     | Connected accounts / snapshot | `STRIPE_WEBHOOK_SECRET_CONNECT`     |
   | `https://bookqualia.com/api/stripe/webhooks/accounts-v2` | Your account / thin           | `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2` |

3. Save the live key as Production Secret `STRIPE_RESTRICTED_KEY`. Set `STRIPE_ENVIRONMENT=live`, `STRIPE_LIVE_ONBOARDING_ENABLED=true` and **retain `STRIPE_LIVE_PAYMENTS_ENABLED=false`**. Redeploy the complete set together. `NEXT_PUBLIC_SITE_URL` remains `https://bookqualia.com`; Supabase and email settings do not change. No Stripe browser publishable key is required.
4. Keep the global booking policy disabled and the live commercial policy absent or disabled. **No database policy change is needed for host onboarding:** verified hosts use the existing account reservation/creation/sync path, independent of checkout policy. Mappings are unique per host/environment, so a new live mapping preserves the sandbox mapping. Check actual host onboarding and capability refresh before declaring this path ready; account return alone is not completion.
5. Before cutover, confirm no outstanding sandbox bookings, payment attempts or operations need reconciliation. Once clear, reversibly disable and retain the sandbox destinations that target `bookqualia.com`; the deployed handlers accept one configured environment/key/secret set, so later sandbox deliveries would fail against live configuration. Preserve destination IDs and the prior READY deployment `dpl_5Vtuk2kMNUzGQgGxNb4KJBaSobAB` for recovery. Do not delete mappings or provider objects.

For a rollback after a real host account exists, set `STRIPE_LIVE_ONBOARDING_ENABLED=false` and keep live credentials and webhook destinations active so account events continue to reconcile; live payments remain false. A code rollback must retain a compatible live environment. Switching the whole runtime back to sandbox requires coordinating destinations and outstanding live events, not merely changing a flag. Complete sandbox financial acceptance and the remaining commercial/legal configuration separately before enabling real checkout or transfers.

## Webhook destinations

The three **live** destinations are active. All five retained sandbox destinations to the production origin are disabled, including the two earlier incorrect payout destinations. The table below is the required mapping in each environment. For a separate staging installation, open its sandbox's [Workbench Webhooks](https://dashboard.stripe.com/webhooks) → **Create an event destination**, choose each stated source/payload and event list, and use the exact staging HTTPS origin plus the path. Use the API version above for both snapshot endpoints.

**Accounts v2 thin notifications use Your account.** They describe Account objects managed by the platform. Only the payout snapshot endpoint uses Connected accounts. These are three separate destinations with three separate signing secrets; do not reuse a CLI forwarding secret for a Dashboard destination.

On each destination reveal its signing secret once and paste it directly into the matching Vercel Sensitive variable: platform → `STRIPE_WEBHOOK_SECRET_PLATFORM`, payouts → `STRIPE_WEBHOOK_SECRET_CONNECT`, Accounts v2 → `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2`. Redeploy after saving environment changes. Preserve the raw body; these handlers verify signatures before parsing/provider reconciliation.

| Destination                        | Source / payload                  | Events                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/stripe/webhooks`             | Your account / snapshot           | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `transfer.created`, `transfer.reversed` |
| `/api/stripe/webhooks/connect`     | Connected accounts / snapshot     | `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`, `payout.reconciliation_completed`                                                                                                                                                                                                                                                                                 |
| `/api/stripe/webhooks/accounts-v2` | Your account / thin (Accounts v2) | `v2.core.account[configuration.recipient].capability_status_updated`, `v2.core.account[configuration.recipient].updated`, `v2.core.account[requirements].updated`, `v2.core.account.closed`                                                                                                                                                                                                              |

The return URL never confirms a booking. The verified event handler retrieves current Stripe objects, checks environment, and commits through service-role-only database commands. Duplicate/out-of-order notifications cannot downgrade a successful payment. Expired Checkout with an in-flight or incompletely observed successful PaymentIntent keeps its slot held. Investigate repeated delivery failures in Stripe; do not manually mark a payment paid.

## Daily owner workflow

1. Review `/admin/payments`. Check payment state, booking end, disputes and quarantine reasons. The queue shows the most recent 200 attempts and operations; the full ledger remains in the database.
2. After the experience ends and delivery is verified, mark it complete. Review and release eligible host earnings separately. A fresh capability check, the captured policy, delay, disputes/refunds and account restrictions determine eligibility.
3. When a refund is owed, use that exact payment attempt's refund form, enter dollars and the reason, then review the amount. Refunds and recovery of previously transferred host earnings have separate records. Failed host recovery must not erase a successful customer refund.
4. Reconcile pending/unknown operations using their existing operation IDs. If a network error lost the provider reference, locate the Stripe object using its `qualia_operation_id` metadata, then enter its provider ID in the recovery form. The server retrieves it and verifies identifiers, amount, charge and destination before recording it. Operations without a provider reference are never blindly recreated after the 23-hour safety window.
5. If Checkout creation succeeded but its database attachment was lost, locate the Session using `qualia_attempt_id` metadata. The attempt's recovery form verifies the session's booking/attempt references before attachment and reconciliation. Keep the booking held until its provider outcome is established.
6. An untracked Dashboard transfer or financial mismatch freezes release for manual audit. Do not clear the hold merely to make a button work. Compare the charge, transfers, refunds and bank balance, then resolve the ledger with a reviewed maintenance change. Resolve dispute evidence in Stripe.

Hosts see their commission policy, founding credit usage, per-booking fee and transfer/recovery records, and separate bank payout status at `/host/payments`. Setup return alone does not imply verification; refresh status after finishing Stripe's flow.

## Pause and recovery

Pausing commercial settings prevents new checkout quotes; already-created attempts still need reconciliation. Disabling `STRIPE_LIVE_PAYMENTS_ENABLED` blocks new live checkout and new transfers. The separate `STRIPE_LIVE_ONBOARDING_ENABLED` flag controls creating or resuming live host onboarding. Signed webhooks, canonical recovery, refunds on existing payments and existing live host status/dashboard access remain available with the correctly scoped runtime key. A pause does not cancel outstanding sessions, so close and reconcile those explicitly when necessary.

A successful operation is never inferred from a timeout. Keep the same durable operation ID for retries and verify the provider result. A terminal failed transfer needs a newly reviewed release, not a generic retry of its old amount. Refund operations are scoped to the exact charge attempt, including duplicate/quarantined payment recovery.

## Required sandbox acceptance before launch

Local tests exercise real SDK serialization with a fake HTTP transport, signature rejection, canonical payment normalization, expiry holds, and durable unknown-result recovery. Database tests exercise permissions, commercial gates, credit reservations and financial state changes. These do not establish that a deployed Stripe integration works.

Run an actual sandbox host→guest→owner round trip: host verification and capability refresh; host accepts request; guest reviews terms and pays; webhook confirms the booking once; owner marks completion and releases; host sees transfer and bank payout state. Also test a retryable card failure, asynchronous pending/failure, expired session with a processing intent, duplicate/out-of-order delivery, two simultaneous reservations for the final configured free credit, a late payment, partial/full refunds before and after transfer, failed recovery, restricted host account, lost API responses and webhook-before-ledger-record delivery. Verify email confirmation only follows authoritative paid state. Keep live payments disabled until these pass and owner commercial/legal configuration is approved.

Primary references: [Accounts v2](https://docs.stripe.com/connect/accounts-v2), [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhooks](https://docs.stripe.com/webhooks), [idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Owner setup references: [Manage sandboxes](https://docs.stripe.com/sandboxes/dashboard/manage), [restricted API keys](https://docs.stripe.com/keys/restricted-api-keys), [event destination scopes](https://docs.stripe.com/webhooks#listen-to-events-from-connected-accounts). Dashboard guidance rechecked October 11, 2026.
