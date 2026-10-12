# Launch operating decisions — owner approved

**October 12, 2026 — operating terms approved.** The owner explicitly accepted these operating terms ("look good"). They supersede the earlier 10% lifetime founding rate and ten-booking/six-month offer. The approved sandbox policy was subsequently saved through the owner-authenticated admin UI and verified disabled; this documentation task performs no configuration writes. Revised outreach drafts and the first sending batch are **not approved** by this acceptance. Live payments, final legal documents, provider setup and spending retain their separate gates.

## Approved offer and operating terms

| Decision                 | Owner-approved operating decision                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard commission      | 17.5% of the booking price. Listing is free.                                                                                                                                                                                                                                                                                                                |
| Founding commission      | 12.5% ongoing, locked for the agreed founding cohort; this changes the earlier 10% choice.                                                                                                                                                                                                                                                                  |
| Free period              | First 3 eligible paid bookings **or 3 calendar months**, whichever comes first. Zero platform commission; actual payment-processing fees still apply.                                                                                                                                                                                                       |
| Cohort and activation    | First 40 verified hosts enrolled after an approved listing is published. Record the agreed go-live activation timestamp; count the cap across policy versions. Do not enroll draft/unapproved hosts or start the window before their listing is live.                                                                                                       |
| Processing and Connect   | Deduct verified actual processor costs from host proceeds under disclosed terms. Qualia absorbs separate Connect account/payout/platform overhead; the current model does not pass those costs through to hosts.                                                                                                                                            |
| Referral                 | One additional commission-free booking per approved qualifying host referral, maximum 2 credits per referring host. Qualify after the referred host's first completed, paid, nonrefunded booking; operator verifies before granting. Reuse the existing credit ledger—no cash bonus or new $20-credit ledger. Final terms must explain credit order/expiry. |
| Host fund release        | After experience end plus 48 hours **and** admin-confirmed completion, subject to financial holds. Release is a transfer to the host's Stripe balance, not a promised bank-arrival time.                                                                                                                                                                    |
| Cancellation             | Full guest refund when cancelled at least 48 hours before start, or when the host cancels. Later guest cancellations have no automatic refund; legal review and operator handling remain required. This is not published legal wording.                                                                                                                     |
| Promotion restoration    | A successful full refund restores the used promotional credit under its captured terms. Partial refunds do not restore a whole credit.                                                                                                                                                                                                                      |
| Response/payment windows | Host response within 24 hours; guest payment within 24 hours after acceptance, capped by experience start. Request/acceptance admission requires more than 32 minutes before start; opening a new Checkout requires at least 31 minutes remaining for Stripe's expiration margin.                                                                           |

Include a Founding Host badge, rotating category prominence at launch, listing-copy assistance, one approved launch-content feature and early product feedback. These have staff-time costs and do not guarantee traffic or bookings. Do not promise every founder a permanent number-one position.

## Economics and spending guardrails

At a $150 booking, three waived commissions cost **$45 per host / $1,800 across 40 hosts** relative to the earlier 10% founding rate; **$56.25 / $2,250** relative to the approved 12.5%; and **$78.75 / $3,150** relative to standard 17.5%. These are alternative foregone-revenue comparisons, not additive cash expenses or a sales forecast. Ten free bookings instead of three would forgo another $4,200 across 40 hosts at 10%.

[Stripe US pricing](https://stripe.com/us/pricing) lists 2.9% + $0.30 for a domestic card: $4.65 on $150. International cards/conversion can cost more, and original processing fees generally remain after refunds. [Connect pricing](https://stripe.com/connect/pricing) lists $2 per monthly active account and 0.25% + $0.25 per payout when the platform handles pricing; confirm applicable routing/platform line items and actual account pricing before treating this as all-in. Host processor deductions do not cover this overhead or eliminate Qualia's refund/dispute obligations. If Qualia subsidized cards for all three free bookings across 40 hosts at $150, that alone would be $558 cash.

| Illustrative $3,000 cash allocation | Amount |
| ----------------------------------- | -----: |
| Advertising                         |   $900 |
| Tools, mailbox and domain           |   $300 |
| Legal and operations                |   $700 |
| Refund/dispute/operating reserve    |   $700 |
| Content                             |   $400 |

This allocation is **not quotes or spending approval**. Vercel now visibly reports the Qualia team on Pro. The reviewed price was $20 immediately and $20/month baseline plus taxes/metered usage. The scheduler/diagnostic release is READY and the owner diagnostic is provider-delivered. The worker-enable/logging release is READY and actual authenticated Cron execution is verified with an empty queue. Start with only a $200–300 advertising test after approved inventory and checkout are verified; release further spend based on completed bookings. The legal allowance may be insufficient for the approved activity scope. At a $1,000 total budget, prioritize essential operations, reserve and direct recruitment before broad ads.

## Outreach and activation gates

All prospect messages remain **HOLD**. The operating terms are approved. Still required: owner approval of the revised lead list and individualized drafts, sender and first batch; a valid business postal address; verified mailbox connection and provider-policy suitability. Draft sender: `Axel at Qualia <axel@bookqualia.com>`. The owner created Qualia mailboxes, but only the personal Gmail connector is available at this checkpoint. Automatic approval review rejected Gmail browser access because Qualia sign-in authorization did not cover exposing that personal mailbox; connecting the Qualia sender remains blocked and incomplete.

[Resend's AUP](https://resend.com/legal/acceptable-use) prohibits unsolicited cold outreach. [Gmail Program Policies](https://support.google.com/mail/answer/16734397) prohibit unsolicited commercial mail; [Workspace's AUP](https://workspace.google.com/terms/use_policy/) prohibits unsolicited mass email and solicitations without a numerical safe threshold. Low volume/personalization is not a verified exception. Resolve provider suitability; prioritize requested followups, warm introductions and relevant channels expressly inviting partnership proposals. Do not switch to personal Gmail as a workaround. The requested ceiling is about 20/day with no more than one follow-up, subject to provider permission and suppression rules. [CAN-SPAM](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) also requires truthful identity/subject, commercial identification, postal address and effective opt-out handling.

The three configurable-incentive, expiry and payable-deadline migrations are **applied to hosted Supabase**; the corresponding application is deployed at `471dc55`. The approved sandbox commercial policy is saved and verified disabled; the prior zero-policy count is superseded. No new inventory or bookings are established by this checkpoint. Use the saved operating terms for sandbox preparation and complete the separately authorized hosted rehearsal. Live charging and outreach remain disabled. Worker scheduling and enablement are verified after the delivered owner diagnostic and an authenticated zero-work scheduled run; it does not enable booking requests or commercial payments. See [financial RPC contract](financial-rpc-contract.md), [Stripe operations](stripe-operations.md) and [email setup](email-setup.md).

## Sandbox configuration — commercial save verified disabled

The owner-authenticated admin UI saved these commercial settings **disabled**. Read-back verified policy `09c510e0-1c08-40c7-a33a-0c5981138271`, sandbox, version `sandbox-2026-10-12-v1`, approved by the verified owner. The following records the exact database payload for those settings; do not create a duplicate policy merely to repeat setup. It is an internal sandbox operating version, not counsel-approved public Terms. `admin_set_commercial_policy` requires a verified admin identity; do not bypass that check with a fabricated actor. The web form accepts percentage strings, but this database payload uses integer basis points.

```json
{
  "p_settings": {
    "environment": "sandbox",
    "enabled": false,
    "standard_fee_bps": 1750,
    "founder_fee_bps": 1250,
    "founder_free_bookings": 3,
    "founder_duration_months": 3,
    "founder_cohort_cap": 40,
    "processing_allocation": "host_actual_cost",
    "payout_delay_hours": 48,
    "restore_refunded_credit": true,
    "referral_free_bookings": 1,
    "referral_credit_cap": 2,
    "terms_version": "sandbox-2026-10-12-v1",
    "cancellation_terms": "Sandbox operating terms: A guest cancellation at least 48 hours before the scheduled experience start receives a full refund. A host cancellation receives a full refund. Later guest cancellations have no automatic refund and require operator review. Refunds are processed by Qualia; payment-provider processing times may vary. This sandbox wording is not final production legal terms.",
    "incentive_start": "host_enrollment",
    "cutoff_rule": "checkout_before_cutoff_frozen_quote",
    "refund_rule": "proportional_commission_nonrefundable_processing",
    "completion_rule": "admin_after_end",
    "liability_acknowledged": true
  }
}
```

The 24-hour response/payment values were saved through the authenticated admin UI and read back as disabled, 1440/1440 minutes, approved by the verified owner. The payload below records that persisted configuration. For `admin_set_booking_policy`:

```json
{
  "p_request_expiry_minutes": 1440,
  "p_payment_deadline_minutes": 1440,
  "p_enabled": false
}
```

Saving and enabling are distinct actions. The disabled payloads preserve the launch gates; enable only as part of the authorized sandbox rehearsal. Booking policy has no sandbox/live field and affects requests globally. Keep `STRIPE_ENVIRONMENT=sandbox` and `STRIPE_LIVE_PAYMENTS_ENABLED=false`.

The commercial RPC requires `liability_acknowledged=true` even for a disabled save: its review text states that Qualia bears platform payment costs/losses under this Connect setup. The approved packet already discloses separate Connect overhead and refund/dispute obligations; this value records that operating-policy approval, **not acceptance of Stripe's separate legal agreements**. The required rule enums preserve the implementation's existing semantics: proportional commission refunds, potentially nonrecoverable actual processing fees, admin completion after the experience, and frozen pre-cutoff Checkout quotes.

No numerical operating decision is missing for this sandbox preparation. Remaining production matters include Qualia's legal entity/identity, a valid postal address, final Terms/Privacy/host and cancellation wording, activity/age/insurance rules, and a provider-permitted outreach channel. The existing ledger spends eligible founding credits before referral credits and has no referral-expiry field; do not invent an expiry or promise automatic referral qualification. Specific host enrollment requires their agreed activation time, published listing, current policy ID and individual consent. No host is enrolled by this payload.
