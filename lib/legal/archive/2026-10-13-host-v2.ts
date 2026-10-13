import type { LegalDocumentContent } from "../types";

// Published archive: owner-approved reduction to the first 30 founding hosts.
// Only cohort size changes; all other accepted commercial terms are preserved.
// Never change this wording under the same version. Keep the v1 archive intact.
export const hostTerms: LegalDocumentContent = {
  title: "Host terms",
  href: "/host-terms",
  version: "qualia_host_2026_10_13_v2",
  effectiveDate: "October 12, 2026",
  sections: [
    {
      heading: "Your listing and obligations",
      blocks: [
        {
          type: "paragraph",
          text: "You must be at least 18 to host. Your platform agreement is with Axel Paulhiac, operating under the Qualia brand. You provide the experience as an independent host and are responsible for accurate descriptions, qualifications, lawful operation, venue permission, required licenses and the insurance applicable to your activity. Submit the participant age range, hazards, supervision arrangements, equipment and emergency plan for review. A submitted listing is not approved until Qualia publishes it.",
        },
        {
          type: "paragraph",
          text: "Report material changes to your activity, location, equipment, credentials, coverage or supervision plan before accepting affected bookings. Do not offer a higher-risk variation, different age range or substitute operator that has not been reviewed. Qualia may pause affected listings while required evidence is missing or an incident is investigated.",
        },
        {
          type: "paragraph",
          text: "For experiences involving minors, follow the approved guardian-consent, supervision, communication and collection process. Do not represent a generic adult waiver as sufficient for a child. Do not collect unnecessary child identifiers, private photographs or health records through ordinary booking messages.",
        },
      ],
    },
    {
      heading: "Fees and payment",
      blocks: [
        {
          type: "paragraph",
          text: "Listing is free. The standard Qualia commission is 17.5% of the booking price. The actual payment-processing costs associated with a booking are deducted from host proceeds as shown in the payment ledger. Qualia pays separate Stripe Connect account, payout and platform overhead under the current model. Processing costs may remain even if a payment is refunded; the ledger records the actual provider result.",
        },
        {
          type: "paragraph",
          text: "Hosts complete Stripe's required onboarding and maintain an eligible payout account. Qualia initiates release of eligible earnings only after the scheduled experience ends, at least 48 hours have elapsed, and an administrator confirms completion. Refunds, disputes, verification problems and other financial holds may delay release. A transfer to a Stripe balance is not a promise of the date funds arrive in your bank account.",
        },
        {
          type: "paragraph",
          text: "Qualia administers refunds under the cancellation policy and applicable law. Refunded amounts reduce the related commission proportionally. If earnings were already transferred, Qualia may recover the refundable host share through Stripe transfer reversal where available. Original actual processing costs may be nonrecoverable. Qualia will show the refund and recovery in the ledger; a full guest refund does not mean every provider fee is returned.",
        },
      ],
    },
    {
      heading: "Founding hosts",
      blocks: [
        {
          type: "paragraph",
          text: "The founding offer is available to the first 30 verified hosts whom Qualia individually enrolls after an approved listing is published. Enrollment requires the host's acceptance and an agreed activation timestamp. Your accepted policy version and activation time are recorded.",
        },
        {
          type: "paragraph",
          text: "An enrolled founding host pays no Qualia commission on the first 3 eligible paid bookings or during the first 3 calendar months after activation, whichever limit is reached first. Actual processing fees still apply. The ongoing founding commission is 12.5%, locked for the agreed founding cohort.",
        },
        {
          type: "paragraph",
          text: "A Checkout opened before the offer cutoff uses its captured quote until that Checkout expires. A successful full refund restores the promotional credit used by that booking under its captured terms; it does not restart the calendar window. A partial refund does not restore a whole promotional credit.",
        },
        {
          type: "paragraph",
          text: "A qualifying host referral earns one additional commission-free booking, up to 2 credits per referring host. Qualia verifies qualification after the referred host's first completed, paid and nonrefunded booking. Credit is not automatic and has no cash value. Eligible founding credits are used before referral credits. The current offer sets no separate referral-credit expiry.",
        },
        {
          type: "paragraph",
          text: "Founding benefits include a badge, rotating category prominence at launch, listing-copy assistance, one approved launch-content feature and early product feedback. These benefits do not guarantee traffic, bookings or a permanent top position.",
        },
      ],
    },
  ],
};
