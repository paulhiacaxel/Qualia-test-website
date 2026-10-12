# Stripe setup and operating guide

Implementation: stripe-node 23.0.0, API `2026-09-30.endive`, Accounts v2 Express recipient accounts, hosted Checkout, separate charges and transfers. Checkout charges Qualia's platform; the database freezes commission and incentive credits. Qualia releases eligible host earnings manually after verified completion and the approved delay. A host transfer is distinct from a Stripe bank payout.

## Current sandbox configuration — October 12, 2026

The sandbox is `acct_1SKPOxDIzwThjgQA`, with `livemode=false` and **Connect Marketplace enabled**. After renewed browser approval, the earlier SMS attempt was found to have succeeded despite the authentication tool's failure report. All configuration below was performed in the sandbox.

Dedicated restricted key **Qualia sandbox app** (`mk_1UPkb4DIzwThjgQARHnBkBjC`) is stored as Sensitive Production `STRIPE_RESTRICTED_KEY`. READY deployment `dpl_DmSfo2PvjQG2s72b8HCSHUgkx24N` loads it and the three active signing secrets at reviewed commit `471dc55fd6029940b333d4a5813668c93b1f797f`. Secret values remain outside the repository; temporary transfer files were deleted.

| Destination                            | ID                                                     | Verified state                                                                       |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Platform snapshots                     | `we_1UPjZeDIzwThjgQAclqYI3H5`                          | Existing platform destination; `STRIPE_WEBHOOK_SECRET_PLATFORM` loaded               |
| Corrected Connect payout snapshots     | `we_1UPkTKDIzwThjgQAIQtjmXFc`                          | Enabled, `@accounts` / snapshot; corrected `STRIPE_WEBHOOK_SECRET_CONNECT` loaded    |
| Accounts v2 thin events                | `ed_test_61VZ7YBgatG2p8hK916TTnMJSmSQozILacixY42JEPZY` | Existing Your account / thin destination; `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2` loaded |
| Incorrect original payout destination  | `we_1UPjaKDIzwThjgQAinUcI1AR`                          | Disabled, `@self` / snapshot                                                         |
| Incorrect duplicate payout destination | `we_1UPjeCDIzwThjgQAzDVeQRVx`                          | Disabled, `@self` / snapshot                                                         |

Dashboard inspection confirmed both earlier payout destinations had **Your account** scope. The supported update APIs cannot change this source: [V2 event-destination update](https://docs.stripe.com/api/v2/core/event_destinations/update) states event scopes are configured at creation, and [V1 webhook update](https://docs.stripe.com/api/webhook_endpoints/update) has no `connect` parameter. After enabling sandbox Connect, the replacement was created with **Connected accounts / Snapshot**, API version `2026-09-30.endive`, the six payout events below and the existing Connect URL. Both incorrect destinations were then reversibly disabled. V1 and V2 API read-back confirmed the replacement remains enabled and its source is `@accounts`.

The initial runtime-key Accounts v2 read failed with HTTP 403 until the separate **Accounts v2: Read** and **Recipient Configuration: Write** grants were added. The key value was unchanged, so no further redeploy was needed. With API version `2026-09-30.endive`, actual runtime-key reads now return HTTP 200 and empty lists for `/v2/core/accounts?limit=1` (`req_v2qvgDoH9T9OBTzgq`) and `/v1/checkout/sessions?limit=1` (`req_R0Dbk4rOqnXYYz`). All three deployed webhook routes reject missing and invalid signatures with HTTP 400. These are configuration and negative checks, not a completed payment/webhook rehearsal: no account, checkout payment, refund, transfer or payout was created by these checks. Full sandbox acceptance remains pending approved fixtures and explicit commercial/booking policies.

## Before sandbox use

Use the owner checklist in [owner-setup.md](owner-setup.md). The production origin is `https://bookqualia.com`; configuring that origin does not enable real payments.

1. In the [Stripe Dashboard](https://dashboard.stripe.com/), select the existing sandbox identified above and check that the sandbox banner is visible. Sandbox access is verified through the connected tools; there is no need to create another one.
2. The existing sandbox's Connect Marketplace setup is complete. For another sandbox, complete Connect setup if Stripe requests it. The integration is a marketplace: Qualia collects the guest payment, hosts use an Express dashboard, Qualia manages pricing and negative balance liability, and separate charges/transfers support release after completion. The owner supplies business facts and accepts any required agreements; do not invent or pre-accept these.
3. The existing sandbox key is **Qualia sandbox app**. Do not create a duplicate. Its persisted Dashboard grants are recorded below. For another environment, start with no permissions and grant only the resources required. Write includes Read. The connected-account column appeared after Connect Marketplace was enabled in this sandbox.

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
- `NEXT_PUBLIC_SITE_URL=https://bookqualia.com` for Production; use a separately configured exact staging origin for Preview

Do not use a real live account as a sandbox. This repository does not provision an account or accept platform/host legal agreements. Owners complete Stripe's platform business verification and Connect setup themselves. Host onboarding collects identity and business information in Stripe's hosted forms, without inferring an entity type or accepting terms for them.

The owner approved and saved a **sandbox** commercial policy at `/admin/commercial`, verified disabled as `09c510e0-1c08-40c7-a33a-0c5981138271` (`sandbox-2026-10-12-v1`). It records: rates, founding free-booking count/calendar-month duration/cohort cap, processing allocation, release delay, cancellation wording/version, refund restoration and referral grant/cap. See the approved [launch decisions](launch-decisions-proposed.md); the historical offer is not an active policy. The configurable-incentive migration is applied to hosted Supabase; the corresponding application is deployed at `471dc55`. Enrollment requires a verified host with a published listing and consent to the displayed policy version; it freezes the agreed start, count, window, rate and restoration rule. Existing quotes keep their policy, and guests accept displayed cancellation terms before Checkout. The saved policy remains disabled; enable only for the authorized sandbox rehearsal. Complete owner-approved Terms, Privacy and host agreements remain launch prerequisites.

## Preparing real host onboarding

The prepared source change separates `STRIPE_LIVE_ONBOARDING_ENABLED` from `STRIPE_LIVE_PAYMENTS_ENABLED`; no live provider settings or flags were changed by its implementation. The onboarding flag defaults to **false** and must be explicitly set to `true` only after the intended Qualia live account, restricted key and live webhook destinations are configured. With that flag enabled, verified hosts can create or resume live Connect onboarding while guest checkout and new transfers remain paused. Existing live payout status and dashboard access remain available during either pause. Completing Stripe setup neither publishes a listing nor enables guest payments.

Sandbox payout pages and actions are restricted to verified administrators using the current server-side `is_admin` check. Public hosts can still sign up, complete their profiles and submit listings; they are not directed into sandbox payout setup. Do not grant an administrative role merely to let a prospective host test payments.

**Live-account reuse authorized:** on October 12 the owner explicitly allowed retiring ChronosLuxe and repurposing account `acct_1SKPOXDqyZniopvO` (Axel Paulhiac) for Qualia. Fresh reads found no charges, subscriptions (all statuses), connected accounts, available balance or pending balance. The two old ChronosLuxe payment/identity webhook destinations were reversibly disabled and their disabled state read back. Do not delete the account, change its bank or alter its legal identity to perform this migration.

The public URL still reads `https://chronosluxe.base44.app`, product description **Watch Rental**, and statement descriptor **CHRONOSLUXE**. Charges and payouts are enabled, but `individual.verification.proof_of_liveness` is currently due and past due. Dashboard credential protection prevented public-profile edits; the owner identity check is also outstanding. Configure public business name **Qualia**, URL **https://bookqualia.com**, support email **support@bookqualia.com**, statement descriptor **BOOKQUALIA**, and an accurate description of the Miami one-on-one educational-experiences marketplace. Use the approved business mailbox only for public support correspondence, not as an invented physical/KYC address. Retain Axel's actual legal identity and verified payout details.

Live Connect configuration, a dedicated restricted live runtime key and three Qualia live destinations/signing secrets remain unconfigured. No live flags were enabled and no live charge was created. The separate sandbox `acct_1SKPOxDIzwThjgQA` is now accessible through the connector; sandbox credentials and connected accounts cannot be reused as live resources. Full hosted Checkout/refund/release acceptance remains outstanding, so provider account readiness alone is not application launch approval.

## Webhook destinations

The current destinations are configured and the two incorrect payout destinations are disabled; preserve that state. The table below is the required mapping. For a separate staging installation, open its sandbox's [Workbench Webhooks](https://dashboard.stripe.com/webhooks) → **Create an event destination**, choose each stated source/payload and event list, and use the exact staging HTTPS origin plus the path. Use the API version above for both snapshot endpoints.

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
