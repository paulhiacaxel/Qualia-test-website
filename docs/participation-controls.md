# Adult accounts and activity participation

The owner approved adult account holders, hosts and bookers (18+), with a parent or legal guardian booking eligible minors. All existing categories remain eligible for review. This change implements that model; it does not create a liability waiver, approve legal wording, establish insurance coverage or enable payments.

## Account and booking flow

- Signup asks the adult to confirm eligibility. After email confirmation, a separate signed-in action records `adult_account_v1` and its timestamp. Existing users complete the same step before new hosting work or booking. User-editable Auth metadata cannot supply the recorded attestation.
- Existing booking history, declines, cancellations and Stripe payout records remain accessible without the new attestation. Password recovery keeps its existing route.
- The booker selects themselves or a minor for whom they are a parent/legal guardian. The form records age in completed years on the experience date, not a child’s name, birth date or medical history.
- The approved age range, risks, equipment, prerequisites and supervision arrangements are shown before requesting. Guardian authority and the approved supervision arrangements require explicit confirmation for a minor.
- The database captures the participant acknowledgments, account-attestation version, timestamp and exact approved rules. Changing the activity, participants or dates requires a new booking; a saved age acknowledgment cannot silently move to a different date.

## Host submission and review

Hosts can save incomplete drafts. Submission requires an age range, proposed guardian presence, public participation instructions, risks, equipment, prerequisites, supervision plan and private evidence notes covering qualifications, insurance, venue and emergency arrangements. Hosts explain requirements that do not apply and identify unresolved evidence. The form does not label an assertion as verified coverage.

An admin records approval or rejection of the exact submitted version, a host-visible explanation and an expiry. Approval cannot outlast the supplied evidence expiry. Allowing a minor without a guardian physically present requires a separate explicit admin decision. The existing safety-review, consultation and publication steps remain separate.

Material changes invalidate the activity review. Approved public instructions contain no private insurance, credential or venue evidence. Review history and booking acknowledgments are append-only through the application. There is no category-wide automatic approval or exclusion.

## Enforcement and deployment

Migration: `20261012233416_guardian_activity_participation.sql`.

The four-argument `request_booking` RPC requires participant data. The older three-argument endpoint fails closed. Validation is repeated inside PostgreSQL so bypassing the form cannot create an unacknowledged request. Review validity must cover the whole scheduled experience. New acceptance and Checkout reservation recheck eligibility and review version. If rules change while a payment is in flight, canonical payment evidence is still recorded and the unsettled charge is quarantined for refund review. Already-paid reconciliation and refund handling remain active.

No existing user is backfilled as an adult and no prior booking is given fabricated consent. Historical bookings can therefore have no participation snapshot. The existing rehearsal’s fully refunded bookings remain historical financial evidence.

The previous local rehearsal helper moved paid fixture dates backward to exercise release timing. It cannot move a newly captured participation booking: that would invalidate the age-on-experience-date evidence. The runner now fails closed for such a fixture. Preserve the captured delay and dates when planning subsequent provider checks.

## Still separate before guest launch

- Approve exact public Terms, Privacy, Host Terms and Cancellation wording, including the actual retention and support procedures.
- Resolve any activity-specific guardian documentation, releases, insurance, licensing and venue requirements for each listing. These participation acknowledgments are not those documents.
- Complete the remaining provider acceptance cases recorded in `rehearsal-evidence-2026-10-12.html`; automated database tests do not prove every provider-level scenario.
- Approve and publish actual inventory, then activate the approved live commercial policy, booking requests and live guest payments together. No fee or incentive changes are introduced here.

The live Stripe platform, connected owner host and three live webhook destinations were independently rechecked before this work. The separate rehearsal project and deployment were also found using the existing Vercel connection, with the optional `teamId` omitted; no additional access or project was needed.
