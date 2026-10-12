# Qualia launch setup and acceptance

## Current boundary

The code implements the guest, host, review, booking, payment, email, and support workflows. The original static demo is retained as reference but is not served by Next.js. Empty published inventory produces a truthful pre-launch page. Upload only photos the host has authorized; do not use example experiences, fabricated reviews, or third-party portfolios as live inventory.

At the October 12, 2026 checkpoint, the owner-created Supabase project `Qualia` (`fjotwcufttuccebrbgsp`, us-east-1) has the reviewed schema applied. https://bookqualia.com serves the pre-launch app with verified HTTPS and www redirect. Resend domain verification, custom Auth SMTP and confirmation/recovery templates are saved; exact Auth URLs are verified. Stripe sandbox Connect Marketplace is enabled, the restricted runtime key is saved, and the corrected connected-account webhook is active while both incorrect destinations are disabled. Limited runtime-key Accounts v2 and Checkout reads return HTTP 200. READY production deployment `dpl_CpYSiTm2z7Mk9fHph35d3m3UZ5t9` now loads the saved Supabase/Resend secrets, sandbox runtime key and corrected webhook secrets at application commit `53bf519bd80936ba55cb07ea092d13f24ee2f331`. See [deployment checkpoint](deployment-checkpoint.md). Resend verified signup confirmation delivery; the owner reports signup/sign-in worked, and the confirmed account's owner-authorized private admin grant was verified. Recovery, cross-device links, booking delivery, payment flows and the full hosted rehearsal remain unverified. No live payments, payouts, outreach or booking-worker messages have been sent. Final validation passed 138 tests, TypeScript, formatting and production build. The earlier dependency audit reported no known production vulnerabilities; it was not rerun for this release. Local PostgreSQL and code tests are not substitutes for the acceptance checks below.

## Owner decisions

| Decision                                                                                 | Where it is applied                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical domain                                                                         | Vercel project domain, `NEXT_PUBLIC_SITE_URL`, Supabase Auth URLs, sender DNS                                                              |
| Standard and lifetime founding commission                                                | `/admin/commercial`; reopened rates and configured incentive terms require explicit approval; see [proposal](launch-decisions-proposed.md) |
| Who pays actual Stripe processing costs                                                  | `/admin/commercial`; zero commission is not zero payment-processing cost                                                                   |
| Founder enrollment time, referral grant/cap, refunded credit restoration                 | Explicit admin controls; no host is automatically enrolled                                                                                 |
| Cancellation/refund/no-show terms and payout delay                                       | Versioned commercial policy, guest checkout disclosure, host agreement                                                                     |
| Request and payment deadlines                                                            | `/admin/settings`; allow enough payment time for Stripe's 30-minute minimum Checkout expiration plus a margin                              |
| Legal identity, Terms, Privacy, host agreement, age policy, category safety/waiver rules | Counsel-approved documents and product rules before opening paid bookings                                                                  |
| Insurance and permits                                                                    | Category-specific broker/legal review; a waiver or Stripe identity check does not establish coverage or safety                             |
| Qualia support/outreach mailbox and postal address                                       | Auth SMTP, transactional sender, outreach signature and suppression process                                                                |

The owner purchased `bookqualia.com` through Vercel. `support@bookqualia.com` was created by the owner and is linked on the website through `CONTACT_EMAIL`. Resend sender-domain and owner signup-confirmation delivery are verified; support-mailbox replies and booking-message delivery remain untested. Outreach drafts name `axel@bookqualia.com`; only personal Gmail is connected. All prospect messages remain HOLD pending mailbox connection, provider-policy review, postal address, terms and first-batch approval. Resend cannot send cold outreach. Follow [owner setup](owner-setup.md) for the remaining steps; never place passwords, billing details, or API secrets in source control or chat.

## 1. Supabase configuration and acceptance

Follow [authentication setup](phase-1-setup.md). The original eight migrations plus configurable incentives (`20261012161729`), scheduled expiry (`20261012161739`) and payable deadlines (`20261012161747`) are applied to the owner-created project. The corresponding application is deployed at `53bf519`. Hosted policy, listing and booking counts remain zero. For future changes, use a separate development project and `supabase db push --dry-run` before `db push`; never reset a hosted database. Production URL/publishable key and canonical origin are set. The server-only secret key is saved as Sensitive Production and loaded by the current redeploy. Preview deployments intentionally do not receive the production connection.

Verified-email authentication and domain-authenticated custom SMTP are configured. Owner signup confirmation delivery and reported signup/sign-in are verified. The owner-authorized private admin grant was guarded by the exact confirmed identity and read back successfully. Verify password recovery, cross-device links and logout in real browsers. Run the hosted security/performance advisors and resolve material findings.

Review Storage limits and private bucket policies. Upload an actual camera photo, verify it is transformed without location metadata, and test that a different host cannot read or modify draft assets. Confirm only registered photos belonging to published listings can be viewed publicly. Exact meeting locations must stay private until the correct booking is paid and confirmed.

## 2. Host and review rehearsal

Use two real test accounts and an owner admin account. Complete a host profile, listing, location, photo and future availability; submit once; verify duplicate submission cannot bypass review. Review safety details, request or waive a consultation with a reason, and publish. Reject another draft with clear host feedback and verify editing/resubmission. Pausing a published experience should remove it from discovery.

Try each action as the wrong host and a normal guest using the Data API, not just the page buttons. Neither role may grant admin status, approve a listing, set prices after payment, or view unrelated addresses/messages. A limited desktop signup check confirmed guest/host options, host button text, brand/layout and the support footer link without submitting a form. Full mobile/desktop, keyboard and authenticated browser QA remain outstanding.

## 3. Booking and support rehearsal

Set deliberate booking deadlines in `/admin/settings`. Request the same host/time from two independent database connections and confirm only one hold wins. Test overlap across two listings by the same host, DST transitions, expiry, acceptance, decline and unpaid cancellation. Availability removal must not erase held/confirmed experiences.

Use guest and host booking dashboards to exchange messages. Confirm a third user cannot read or send into the thread. Save a concierge request at `/contact`, answer it at `/admin/support`, and confirm the requester sees the response. Support replies are in-app; do not assume an email notification unless it is specifically implemented and tested.

## 4. Stripe sandbox

Read [Stripe setup and operations](stripe-operations.md), [implementation plan](stripe-plan.md), and [financial RPC contract](financial-rpc-contract.md). Use the configured sandbox and current deployed secrets for an approved rehearsal once sandbox commercial/booking policies and test fixtures are agreed; resource reads and signature-rejection checks do not establish payment acceptance. Keep `STRIPE_ENVIRONMENT=sandbox` and live payments disabled. Accept Stripe's required platform terms in the owner's account only after reviewing the chosen fee/loss responsibility.

The implementation uses Accounts v2 recipient accounts, hosted onboarding, hosted Checkout, and separate charges/transfers after admin-confirmed completion. A host returning from onboarding is not automatically payout-ready. A Checkout success redirect is not proof of payment. Bank payouts are distinct from transfers into a host's Stripe balance.

Create and explicitly approve sandbox commercial settings. Enroll only agreed test founding hosts. Confirm host fee disclosure and guest cancellation-term acceptance. Preserve the verified platform, corrected connected-account and Accounts v2 destinations, leaving both incorrect payout destinations disabled. Exercise signed delivery and required write permissions during the approved rehearsal; current verification covers configuration, limited reads and signature rejection.

Test successful payment, decline/3DS, duplicate checkout clicks, webhook retries/out-of-order delivery, stale checkout, payment success after network uncertainty, restricted host capabilities, founding credits around the configured last free booking and calendar-month cutoff, referrals, refund before/after transfer, partial refund, failed reversal, dispute and payout failure. Reconciliation must preserve a possibly paid slot until the processor's terminal state is known. Never create a fresh idempotency key merely because a response was lost.

Before moving live, reconcile every test operation and document remaining provider limitations. Agree who monitors failed/quarantined payments, refunds, disputes and unrecovered host transfers. Ensure platform cash reserves cover its obligations; the implementation does not create escrow or insurance.

## 5. Transactional email and scheduled work

Follow `docs/email-setup.md` once configuring the provider. Set a verified sender, server-only provider key, trusted site origin and a strong `CRON_SECRET`. Auth SMTP and transactional delivery are separate configurations even if they use one provider.

No schedule is enabled automatically. Vercel is verified Hobby; the $20/month baseline Pro upgrade (reviewed as $20 immediately, plus taxes/metered usage) needs owner approval before five-minute Cron. The expiry migration and its worker caller are deployed; verify approved delivery before enabling scheduling. Choose the approved schedule, authenticate the worker calls, and verify request, acceptance, paid confirmation, cancellation and reminder delivery. Test duplicate worker calls, provider timeouts, cancelled reminders and retries. Booking confirmation must originate from verified paid state. Host outreach uses a separate approval and suppression process; do not feed the prospect list into transactional jobs.

## 6. Pre-launch deployment and paid-launch gates

The real domain can serve the honest pre-launch site with no published inventory and payments disabled. Before opening paid bookings, complete the above gates, configure Stripe live credentials, authenticated mail, approved policy and legal pages. Scope secrets per Vercel environment; do not give unrelated previews production database access. Confirm the intended deployment/commit, attach the purchased domain, set the registrar-provided DNS records, and verify TLS and apex/`www` canonical redirects. Update Auth allowlists and mail links to the canonical origin.

A reachable pre-launch site is not evidence of a verified paid marketplace. Test the entire guest-to-host flow on the actual domain, complete a permitted small live payment/refund only with owner authorization, verify delivery and reconciliation, and then open requests/payments deliberately. Keep outreach unsent until the owner approves the workbook messages, sender, incentive terms and first batch.

## Deferred enhancements

The revolving global map needs actual locations and is not a launch requirement. Optional waiver prompts and category-specific requirements need approved rules before implementation. Real host photographs and approved listings can populate the catalogue without redesigning it. Founder placement must be fair within each category and must not promise a fixed top position to every host at once. Booking messaging, clear support, straightforward rebooking and reliable payouts are the immediate reasons to stay on-platform.
