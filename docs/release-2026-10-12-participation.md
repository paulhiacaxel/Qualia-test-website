# Participation controls release — October 12, 2026

Application source: `2caa54bf9f1852c100ee4619ad0ed0a3d6da38c9`.

| Environment | Deployment | Database |
| --- | --- | --- |
| Production, https://bookqualia.com | `dpl_4DQH42dYunZxspQKp679NNP8yGbg`, READY, aliases assigned | `fjotwcufttuccebrbgsp` |
| Rehearsal, https://project-6v35u.vercel.app | `dpl_D2h2Nw81g5NZXofPMHMVrfo2cBWd`, READY, aliases assigned | `ibkpptqfdjtkybquxzgk` |

The migration was applied to rehearsal first, then production. Both application deployments use the same reviewed commit. An initial rehearsal build was cancelled by the project's ignored-build step; the explicit build used a deployment-specific `exit 1` override. Project credentials and live-payment settings were not changed.

## Verification

- 208 automated tests passed, none failed or skipped; TypeScript, formatting and production build passed.
- Tests include real isolated PostgreSQL checks for adult attestation, private evidence access, revision-bound approvals, guardian acknowledgments, age ranges, whole-session expiry, immutable booking snapshots, legacy RPC denial and payment/refund regression coverage.
- Independent UI/action review found and corrected an overly broad host gate. Existing booking history, declines, cancellations, Stripe dashboard and status access remain available; new participation and onboarding require adult attestation.
- Both hosted databases deny anonymous booking execution, direct authenticated reads of private safety evidence and execution of the retired private three-argument booking function.
- Neither migration backfilled adult attestations or invented prior booking acknowledgments. Production retained zero bookings/payment attempts. Rehearsal retained its two cancelled test bookings and zero failed Stripe events.
- Live and rehearsal signup pages return HTTP 200 with the adult checkbox. Signed-out eligibility requests lead to login. Production discover returns HTTP 200. All three Stripe routes on both environments reject unsigned requests with HTTP 400.
- This release did not repeat a signed provider checkout, collect real money, log in as the owner, publish a listing or claim a complete browser acceptance test of the new private forms.

## Configuration readback

Production remains `STRIPE_ENVIRONMENT=live`, live onboarding `true`, live guest payments `false`, transactional email `true`. Rehearsal is `sandbox`, both live flags `false`, transactional email `false`, and uses its separate Supabase URL. Only these non-secret configuration values were read. Server keys and signing secrets were not retrieved or printed.

The existing live platform and owner connected host are ready, and the three live webhook destinations have correct scopes. The retained sandbox destinations point to rehearsal; the old production-targeting sandbox destinations are disabled. No completed Stripe setup was repeated.

## Remaining owner and operational work

The account and participation controls are now implemented; see [implementation notes](participation-controls.md). Exact public legal wording and retention/support procedures, activity-specific guardian documents/releases and the evidence for actual launch listings still require decisions and review. The [draft packet](launch-legal-drafts.html) remains unpublished. Participation acknowledgment is not a liability release or a guarantee of insurance.

The [historical rehearsal evidence](rehearsal-evidence-2026-10-12.html) records the passed core provider round trip and the provider scenarios not yet run. There are no published production listings. Booking requests and live commercial policy activation remain separate from working host onboarding. Already-approved commercial numbers have not changed.

Supabase's security advisor reports an informational RLS-without-direct-policy notice for private function-controlled tables and a warning that leaked-password protection is disabled in both projects. No broad client policy was added to silence the intentional private-table notice. [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is an Auth setting available on Pro and above; the current connector exposes no Auth-configuration update operation. No plan upgrade or charge was made. The configured 12-character minimum is unchanged.
