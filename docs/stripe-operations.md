# Stripe setup and operating guide

Implementation: stripe-node 23.0.0, API `2026-09-30.endive`, Accounts v2 Express recipient accounts, hosted Checkout, separate charges and transfers. Checkout charges Qualia's platform; the database freezes commission and incentive credits. Qualia releases eligible host earnings manually after verified completion and the approved delay. A host transfer is distinct from a Stripe bank payout.

## Before sandbox use

Configure a dedicated Stripe sandbox and server-only restricted key with the permissions required for Accounts v2/account links, Express login links, Checkout Sessions, PaymentIntents/Charges/Balance Transactions, Transfers/Reversals, Refunds, Disputes, connected Payouts and Event notifications. Keep secret keys out of browser configuration. Set these deployment variables:

- `STRIPE_ENVIRONMENT=sandbox`
- `STRIPE_RESTRICTED_KEY=rk_test_...`
- `STRIPE_WEBHOOK_SECRET_PLATFORM=whsec_...`
- `STRIPE_WEBHOOK_SECRET_CONNECT=whsec_...`
- `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2=whsec_...`
- `STRIPE_LIVE_PAYMENTS_ENABLED=false`
- `SUPABASE_SECRET_KEY` and the existing public Supabase URL/publishable key
- `NEXT_PUBLIC_SITE_URL` set to the exact trusted deployment origin

Do not use a real live account as a sandbox. This repository does not provision an account or accept platform/host legal agreements. Owners complete Stripe's platform business verification and Connect setup themselves. Host onboarding collects identity and business information in Stripe's hosted forms, without inferring an entity type or accepting terms for them.

The owner must explicitly save and enable a **sandbox** commercial policy at `/admin/commercial`: standard commission, founding lifetime commission, processing-cost allocation, release delay, cancellation wording/version, refund credit restoration, and referral grant/cap. No policy or commercial rate is seeded. Founder enrollment records an agreed start and reserves up to ten free bookings until six calendar months later. Existing quotes keep their policy, and guests accept the displayed cancellation terms before Checkout opens. Complete owner-approved Terms and Privacy pages remain a launch prerequisite.

## Webhook destinations

Use the API version above for snapshot endpoints and distinct signing secrets. Preserve the raw body; these handlers verify signatures before parsing/provider reconciliation.

| Destination                        | Source / payload                 | Events                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/stripe/webhooks`             | Platform / snapshot              | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `transfer.created`, `transfer.reversed` |
| `/api/stripe/webhooks/connect`     | Connected accounts / snapshot    | `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`, `payout.reconciliation_completed`                                                                                                                                                                                                                                                                                 |
| `/api/stripe/webhooks/accounts-v2` | Accounts v2 / thin notifications | `v2.core.account[configuration.recipient].capability_status_updated`, `v2.core.account[configuration.recipient].updated`, `v2.core.account[requirements].updated`, `v2.core.account.closed`                                                                                                                                                                                                              |

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
