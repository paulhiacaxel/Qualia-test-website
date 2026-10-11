# Stripe setup and operating guide

Implementation: stripe-node 23.0.0, API `2026-09-30.endive`, Accounts v2 Express recipient accounts, hosted Checkout, separate charges and transfers. Checkout charges Qualia's platform; the database freezes commission and incentive credits. Qualia releases eligible host earnings manually after verified completion and the approved delay. A host transfer is distinct from a Stripe bank payout.

## Before sandbox use

Use the owner checklist in [owner-setup.md](owner-setup.md). The production origin is `https://bookqualia.com`; configuring that origin does not enable real payments.

1. In the [Stripe Dashboard](https://dashboard.stripe.com/), open the account picker → **Switch to sandbox** → **Create sandbox** (or open an existing Qualia sandbox). Name a new one **Qualia staging**, choose whether to copy the existing account's settings, and check that the sandbox banner is visible. Sandbox availability has not been verified in the connected plugin; the last read-only account check exposed only a live account.
2. Complete the sandbox's Connect setup if Stripe requests it. The integration is a marketplace: Qualia collects the guest payment, hosts use an Express dashboard, Qualia manages pricing and negative balance liability, and separate charges/transfers support release after completion. The owner supplies business facts and accepts any required agreements; do not invent or pre-accept these.
3. In the sandbox's [API keys](https://dashboard.stripe.com/apikeys), choose **Create restricted key**, start from no permissions, and name it **Qualia staging app**. Grant only the resource access below. Write includes Read; Dashboard grouping may combine related resources.

| Resource used by this code                              | Platform permission | Connected-account permission |
| ------------------------------------------------------- | ------------------- | ---------------------------- |
| Accounts v2, Account Links and Express login links      | Write               | None                         |
| Checkout Sessions                                       | Write               | None                         |
| Transfers and transfer reversals                        | Write               | None                         |
| Refunds                                                 | Write               | None                         |
| PaymentIntents, Charges, Balance Transactions, Disputes | Read                | None                         |
| Payouts                                                 | None                | Read                         |
| Other resources                                         | None                | None                         |

The current code does not retrieve Events through the API and does not need an Events permission. A publishable Stripe key is not needed for the hosted Checkout redirect. Verify the restricted key against actual sandbox requests and use Workbench permission errors to identify a missing resource grant; do not replace it with unrestricted access.

4. Copy the `rk_test_` value directly into the selected Vercel project's **Settings → Environment Variables**, using a **Sensitive** variable. Never paste keys into chat, source files, logs or browser configuration. Set these deployment variables:

- `STRIPE_ENVIRONMENT=sandbox`
- `STRIPE_RESTRICTED_KEY=rk_test_...`
- `STRIPE_WEBHOOK_SECRET_PLATFORM=whsec_...`
- `STRIPE_WEBHOOK_SECRET_CONNECT=whsec_...`
- `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2=whsec_...`
- `STRIPE_LIVE_PAYMENTS_ENABLED=false`
- `SUPABASE_SECRET_KEY` and the existing public Supabase URL/publishable key
- `NEXT_PUBLIC_SITE_URL=https://bookqualia.com` for Production; use a separately configured exact staging origin for Preview

Do not use a real live account as a sandbox. This repository does not provision an account or accept platform/host legal agreements. Owners complete Stripe's platform business verification and Connect setup themselves. Host onboarding collects identity and business information in Stripe's hosted forms, without inferring an entity type or accepting terms for them.

The owner must explicitly save and enable a **sandbox** commercial policy at `/admin/commercial`: standard commission, founding lifetime commission, processing-cost allocation, release delay, cancellation wording/version, refund credit restoration, and referral grant/cap. The owner approved **17.5% standard commission** and delegated a founding rate choice; **10% lifetime founding commission** is selected after the first ten commission-free bookings or six months, whichever comes first. Record those approved values in the chosen environment. Processing-cost allocation, release delay, cancellation/refund terms and referral grant/cap still require explicit choices. No policy is enabled by this guide. Founder enrollment records an agreed start and reserves up to ten free bookings until six calendar months later. Existing quotes keep their policy, and guests accept the displayed cancellation terms before Checkout opens. Complete owner-approved Terms and Privacy pages remain a launch prerequisite.

## Webhook destinations

After the endpoints are deployed over HTTPS, open the sandbox's [Workbench Webhooks](https://dashboard.stripe.com/webhooks) → **Create an event destination**. For each row below choose the stated source and payload format, select its event types, choose **Webhook endpoint**, and enter `https://bookqualia.com` followed by the path. Use the API version above for both snapshot endpoints. For staging, use its exact deployed HTTPS origin instead.

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

Pausing commercial settings prevents new checkout quotes; already-created attempts still need reconciliation. Disabling `STRIPE_LIVE_PAYMENTS_ENABLED` blocks new live checkout/account creation and new transfers. Signed webhooks, canonical recovery and refunds on existing payments remain available with the correctly scoped runtime key. A pause does not cancel outstanding sessions, so close and reconcile those explicitly when necessary.

A successful operation is never inferred from a timeout. Keep the same durable operation ID for retries and verify the provider result. A terminal failed transfer needs a newly reviewed release, not a generic retry of its old amount. Refund operations are scoped to the exact charge attempt, including duplicate/quarantined payment recovery.

## Required sandbox acceptance before launch

Local tests exercise real SDK serialization with a fake HTTP transport, signature rejection, canonical payment normalization, expiry holds, and durable unknown-result recovery. Database tests exercise permissions, commercial gates, credit reservations and financial state changes. These do not establish that a deployed Stripe integration works.

Run an actual sandbox host→guest→owner round trip: host verification and capability refresh; host accepts request; guest reviews terms and pays; webhook confirms the booking once; owner marks completion and releases; host sees transfer and bank payout state. Also test a retryable card failure, asynchronous pending/failure, expired session with a processing intent, duplicate/out-of-order delivery, two simultaneous tenth-credit reservations, a late payment, partial/full refunds before and after transfer, failed recovery, restricted host account, lost API responses and webhook-before-ledger-record delivery. Verify email confirmation only follows authoritative paid state. Keep live payments disabled until these pass and owner commercial/legal configuration is approved.

Primary references: [Accounts v2](https://docs.stripe.com/connect/accounts-v2), [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhooks](https://docs.stripe.com/webhooks), [idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Owner setup references: [Manage sandboxes](https://docs.stripe.com/sandboxes/dashboard/manage), [restricted API keys](https://docs.stripe.com/keys/restricted-api-keys), [event destination scopes](https://docs.stripe.com/webhooks#listen-to-events-from-connected-accounts). Dashboard guidance rechecked October 11, 2026.
