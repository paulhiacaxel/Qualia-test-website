import type { LegalDocumentContent } from "../types";

// Published archive: never alter this wording under the same version.
// Future publications get a new archive module and a new acceptance version.
// Guest, host and refund wording comes from the owner's approved October 12 packet.
// Privacy describes the providers and manual support process actually used at launch.
export const guestTerms: LegalDocumentContent = {
  title: "Guest terms",
  href: "/terms",
  version: "qualia_guest_2026_10_13_v1",
  effectiveDate: "October 12, 2026",
  sections: [
    {
      heading: "Using Qualia",
      blocks: [
        {
          type: "paragraph",
          text: "Qualia is operated by Axel Paulhiac. In these terms, “Qualia,” “we” and “us” mean Axel Paulhiac operating under the Qualia brand. Qualia helps guests discover, request and pay for experiences offered by independent hosts. Your host provides the experience. Qualia manages the booking and payment process and helps with support. Contact us at support@bookqualia.com.",
        },
        {
          type: "paragraph",
          text: "You must be at least 18 to create an account or make a booking under these terms. A parent or legally authorized guardian may book for a minor when the listing expressly permits the participant's age. The adult booker is responsible for providing accurate participant information and completing the required guardian steps. Do not create an account in a child's name.",
        },
        {
          type: "paragraph",
          text: "Each listing states its approved age range, experience requirements, equipment and supervision rules. Some activities are restricted to adults. A host may not waive a published age limit or required safeguard privately. Changes must be approved by Qualia before the booking proceeds.",
        },
      ],
    },
    {
      heading: "Requests and payment",
      blocks: [
        {
          type: "paragraph",
          text: "A booking request is not a confirmed booking. Hosts have up to 24 hours to respond, subject to the experience start time. If a host accepts, the booking page shows your payment deadline, price and cancellation terms. Pay through Qualia before that deadline. A booking is confirmed only after successful payment is verified and Qualia shows confirmation.",
        },
        {
          type: "paragraph",
          text: "Your total is shown before payment. Do not send card details or bank information to a host or in booking messages. Stripe processes payments. An expired request or payment window may require a new booking, subject to availability.",
        },
      ],
    },
    {
      heading: "Participation and safety",
      blocks: [
        {
          type: "paragraph",
          text: "Read the listing, follow the host's safety instructions and use required equipment. Tell Qualia before booking if you need an accommodation or cannot meet a listed requirement. Share only information needed to assess that request; do not put detailed medical records in ordinary messages. A host or Qualia may stop an activity that cannot proceed safely. The refund policy and applicable law determine the payment outcome.",
        },
        {
          type: "paragraph",
          text: "For minors, the approved supervision and collection arrangements apply throughout the experience. Guardian presence is required unless Qualia has expressly approved a different arrangement for that listing and the guardian has accepted it. Hosts must not arrange private contact with a minor outside the approved communication process.",
        },
        {
          type: "paragraph",
          text: "A listing review or Stripe identity check is not a guarantee of safety, skill, background screening or insurance. Any required activity-specific risk acknowledgment or release is presented separately before participation. Photo or marketing consent is optional and separate from booking and safety consent.",
        },
      ],
    },
    {
      heading: "Support, changes and disputes",
      blocks: [
        {
          type: "paragraph",
          text: "Contact support@bookqualia.com promptly about a cancellation, unsafe condition, incorrect charge or experience problem. In an emergency, contact local emergency services first. Keep booking communications and payment records in Qualia so the issue can be reviewed. Nothing in these terms removes rights that cannot legally be waived.",
        },
        {
          type: "paragraph",
          text: "We may restrict an account or listing when needed to investigate fraud, protect participants or enforce published rules. Existing payment and refund obligations remain subject to the booking's captured terms and applicable law. Material changes to these terms will be identified with a new version; a new booking uses the version shown before payment.",
        },
      ],
    },
  ],
};

export const hostTerms: LegalDocumentContent = {
  title: "Host terms",
  href: "/host-terms",
  version: "qualia_host_2026_10_13_v1",
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
          text: "The founding offer is available to the first 40 verified hosts whom Qualia individually enrolls after an approved listing is published. Enrollment requires the host's acceptance and an agreed activation timestamp. Your accepted policy version and activation time are recorded.",
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

export const cancellationPolicy: LegalDocumentContent = {
  title: "Cancellation and refund policy",
  href: "/cancellation-policy",
  version: "qualia_cancellation_2026_10_13_v1",
  effectiveDate: "October 12, 2026",
  sections: [
    {
      blocks: [
        {
          type: "paragraph",
          text: "Cancel through your booking or contact support@bookqualia.com. We use the scheduled start time shown on the booking, including its time zone.",
        },
        {
          type: "list",
          items: [
            "Guest cancellation at least 48 hours before start: full refund of the amount paid for the booking.",
            "Host cancellation: full refund of the amount paid for the booking.",
            "Guest cancellation less than 48 hours before start: no automatic refund. Qualia reviews the circumstances and any legal entitlement; a host cannot override statutory rights.",
            "Weather, venue closure, safety concerns, interruption or no-show: contact Qualia for review. Do not treat an unsafe session as completed to obtain release. A cancellation by the host receives the host-cancellation refund above.",
          ],
        },
        {
          type: "paragraph",
          text: "Approved refunds are submitted to the original payment method where supported. Your payment provider controls when the credit appears; Qualia does not promise an exact bank posting date. A reschedule requires agreement and availability and does not silently change your cancellation rights. Qualia confirms any revised booking terms before they apply.",
        },
        {
          type: "paragraph",
          text: "Promotional host credits are restored only after a successful full refund, under the captured promotion rules. This does not reduce the guest's full-refund entitlement.",
        },
      ],
    },
  ],
};

export const privacyNotice: LegalDocumentContent = {
  title: "Privacy notice",
  href: "/privacy",
  version: "qualia_privacy_2026_10_13_v1",
  effectiveDate: "October 12, 2026",
  sections: [
    {
      blocks: [
        {
          type: "paragraph",
          text: "Axel Paulhiac, operating Qualia, is responsible for the personal information described in this notice. Qualia uses information to operate accounts, review hosts and listings, manage bookings and payments, provide support and investigate misuse. Contact support@bookqualia.com for privacy requests.",
        },
      ],
    },
    {
      heading: "Information used",
      blocks: [
        {
          type: "paragraph",
          text: "Account information includes your email, profile information and authentication records. Hosts provide listing descriptions, availability, qualifications and review details. Bookings contain participant and scheduling details, messages, status history and the applicable commercial terms. Support requests and safety reports may contain information you choose to provide. Technical records include the requests and errors needed to operate and protect the service.",
        },
        {
          type: "paragraph",
          text: "Stripe collects payment details and required identity, tax and bank information through its payment and onboarding pages. Qualia receives relevant account capabilities, payment identifiers, amounts, fees, refunds, transfers and payout status. Do not send full card numbers, bank details, identity documents or passwords in Qualia messages.",
        },
      ],
    },
    {
      heading: "Sharing and service providers",
      blocks: [
        {
          type: "paragraph",
          text: "Guests and hosts receive the information needed to arrange and perform their booking. Public listings display approved profile and listing information. Exact meeting-location information follows the booking's access rules. Qualia's authorized operators can review information needed for support, safety and payment administration.",
        },
        {
          type: "paragraph",
          text: "Qualia uses Supabase for its application database, authentication and uploaded listing photos; Vercel for hosting; Stripe for payments and host onboarding; Resend for account and booking email; and Google Workspace for team email and support correspondence. Providers process information needed for those services under their applicable arrangements. We may disclose information where required by law or reasonably necessary to investigate fraud or protect people, subject to applicable law.",
        },
      ],
    },
    {
      heading: "Minors and choices",
      blocks: [
        {
          type: "paragraph",
          text: "Adults hold accounts and book for eligible minors. Give only the participant information required for the approved activity and guardian process. Do not create a child's account or upload unnecessary child photographs, identity documents or detailed medical history. A guardian can contact support about information supplied for their child. Photo and publicity permission is separate and optional.",
        },
        {
          type: "paragraph",
          text: "Contact support@bookqualia.com to request access, correction or deletion, or to raise a privacy concern. Include the email associated with your account and what you would like us to review. We may need to verify your identity or authority before responding. Do not email passwords, full payment details or identity documents unless we arrange an appropriate secure process.",
        },
        {
          type: "paragraph",
          text: "The site uses authentication and session storage needed to sign in and maintain account security. Marketing choices are separate from essential booking, payment and account messages. Any additional optional tracking or marketing features must be explained before they are introduced, including any choices that apply.",
        },
      ],
    },
    {
      heading: "Retention and privacy requests",
      blocks: [
        {
          type: "paragraph",
          text: "We keep information while it is needed for the purposes described in this notice. This includes operating an account or booking, resolving support and safety matters, reconciling payments, handling disputes, meeting legal duties and preventing fraud. We review deletion requests and remove or de-identify information when it is no longer needed for those purposes. Different records may need to be kept for different periods.",
        },
        {
          type: "paragraph",
          text: "Privacy requests are handled by the Qualia team rather than an automatic account-deletion process. We review the account, bookings and relevant provider records, explain any information that must be retained and record the outcome. Deleting an account does not necessarily delete records that Stripe or another provider must keep independently. Contact support@bookqualia.com if you need help with a provider-held record.",
        },
      ],
    },
  ],
};
