# Approved legal publication and live guest-payment activation

> Historical activation record. The later owner-approved founding cohort is **30 hosts**, with unchanged 3 eligible bookings / 3 calendar months. See [the cap update](release-2026-10-13-founding-30.md) for the new host agreement and versioned commercial policies; original evidence below remains unchanged.

Completed October 12, 2026, Miami time (October 13 UTC). Application source: `4c304aa43366f760032980e63eca385514e7b662`.

| Environment | Deployment | Status |
| --- | --- | --- |
| https://bookqualia.com | `dpl_5aoRoxtjXxW5aDtMzJpzYfRt9oqN` | READY; production aliases verified |
| https://project-6v35u.vercel.app | `dpl_2pJWCSaiVhxdCfGDxHrrEHS1XhFS` | READY; same application source |

## Approval and delivered behavior

The owner approved the reviewed legal packet and requested completion and activation. Guest terms, host commercial terms, cancellation policy and privacy notice are now published at `/terms`, `/host-terms`, `/cancellation-policy` and `/privacy`. Footer and account links work. Each document has an immutable `/legal/{version}` archive and an effective date of October 12, 2026. Privacy reflects the actual providers and a manual support/retention process; it makes no invented deletion deadline, insurance or attorney-review claim.

Verified adults explicitly accept the agreements on their own signed-in accounts. The database records actor, scope, document versions and timestamp. New bookings and Checkout attempts capture immutable references. New host work, requests and unpaid Checkout require the appropriate agreements. Existing account records, cancellation/refund access, Stripe dashboard/status and financial reconciliation remain available. The migration did not backfill consent, adult attestation or old booking evidence.

The migration `20261013023719_versioned_launch_legal_acceptance.sql` was applied to rehearsal first, then production. SHA-256: `7a8c84c06193ef9d818ef6833f030bf56742459595ccbc0ef5cde4cfcf53bc3a`.

## Verified activation

Production's `STRIPE_LIVE_PAYMENTS_ENABLED` is `true`, scoped to Production and loaded by the new deployment. Live onboarding and the existing live keys/webhook secrets were preserved. No secrets were retrieved or transferred. Rehearsal remains a separate sandbox with transactional email disabled.

At `2026-10-13T02:52:04.720705Z`, the guarded one-time configuration script enabled live commercial policy `a2471d8d-9f80-40b0-8bbf-5f42b2ca8188` and booking requests in one database transaction:

- 17.5% standard commission; 12.5% ongoing founding rate.
- First 3 eligible paid bookings or 3 calendar months, whichever is reached first, with zero platform commission; actual processing costs still apply.
- First 40 individually enrolled eligible founders; no automatic enrollment occurred.
- One referral credit per qualifying referral, maximum 2; full refunds restore used promotional credit, partial refunds do not.
- Actual processing costs deducted from host proceeds; Qualia absorbs separate Connect overhead.
- Release after experience end plus 48 hours, admin-confirmed completion and no financial holds.
- Request and payment deadlines both 1,440 minutes, still capped by start/Checkout timing rules.
- Published cancellation policy captured with version `qualia_host_2026_10_13_v1` and a permanent cancellation-document link.

The configuration records delegated owner authorization and one booking-policy audit entry. It does not impersonate a signed-in account or create legal acceptance. Tests prove a successful rerun changes nothing and a later paused policy cannot silently be re-enabled by rerunning this script.

## Inventory review

The sole submitted record was a placeholder titled `tes`, with description `miami` and no safety submission. It was returned to the owner-host with precise feedback and a delegated-review audit note. Existing photo, meeting and availability records were preserved. Nothing was deleted or approved as a real activity.

Final production readback: zero published listings, zero bookings, zero payment attempts, zero legal acceptances, zero founding enrollments and zero failed Stripe inbox events. Payment infrastructure is active; an actual experience still needs a complete host submission and evidence-based approval before guests can book it. Activity-specific insurance, licensing, venue and any required adult/guardian document remain individual review requirements, not claims established by the generic platform terms.

## Verification and limits

- **238 automated tests passed**, zero failures/skips; TypeScript, formatting, production build and diff checks passed.
- New tests execute actual payment orchestration against controlled provider/ledger responses: asynchronous failure, stale failure after payment, duplicate events, event-before-attachment retry, account/environment isolation, connected payout reconciliation, lost-response recovery, restricted host and failed host recovery while preserving the guest refund.
- PostgreSQL checks cover explicit consent, stale-version rejection, protected records and immutable booking/payment references; seven tests exercise the exact live-activation script. Approved 17.5% / three-booking / 12.5% transitions and final-credit reservation behavior are tested.
- Rehearsal and production legal pages and archives return 200; unknown document versions return 404. Signed-out agreement access redirects to login, preserving the safe destination. Signup/discover respond normally. All three production Stripe routes reject unsigned requests with 400.
- Hosted permissions deny anonymous acceptance, raw authenticated reads and execution of the retired Checkout helper. Existing rehearsal bookings retain null agreement references rather than fabricated acceptance.
- Fresh Stripe readback at 02:51 UTC confirmed platform and live host payouts/transfers active, no due/pending requirements, all three correct live hooks enabled and legacy ChronosLuxe hooks disabled. The two historical sandbox charges remain fully refunded.
- The earlier actual sandbox Checkout/refund/transfer/reversal evidence remains valid. This release did not repeat a real-money charge or claim that every provider fault-injection case was run. Actual bank arrival, every asynchronous provider variant, new sandbox onboarding, cross-device Auth recovery, and booking/reminder mailbox delivery remain observation/follow-up items. Controlled automated coverage is distinguished from actual provider evidence.
- Current email sender/domain is verified with DKIM/SPF and tracking disabled. The five-minute production worker has no backlog or observed failures. Prior signup/diagnostic messages were delivered; no new diagnostic or outreach was sent in this release.
- The new production deployment's runtime scan from 02:50 through 02:54:34 UTC returned no error, warning or fatal records. Its next email-worker run was due at 02:55; the earlier worker evidence is not represented as a run of this new deployment.
- Supabase reports intentional private-table RLS-without-direct-policy informational notices and the existing disabled leaked-password-protection warning. The connector exposes no Auth-setting update; no plan upgrade was purchased. The 12-character minimum remains.

## Operating and future changes

Follow [support and privacy procedures](launch-support-procedures.md). Inspect payment exceptions before manually confirming completion or releasing earnings. For an immediate pause, disable new booking requests and the live commercial policy through admin controls; preserve live credentials/webhooks so existing payments, refunds and recovery continue reconciling. A code rollback must remain compatible with the legal-acceptance schema and live environment; do not restore the old sandbox configuration.

When any bundled legal wording changes, preserve the old archive and issue new document versions. Changes to cancellation/privacy also require new guest/host bundle versions and trusted database manifests, so existing confirmations never accept unseen wording. This release did not create a blanket liability waiver, buy insurance, enroll a founder, publish a test listing or send recruitment messages.
