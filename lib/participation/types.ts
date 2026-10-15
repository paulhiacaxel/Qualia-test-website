/** Participation records deliberately omit names, birth dates and medical details. */
export const ADULT_ATTESTATION_VERSION = "adult_account_v1";

export type AccountEligibility = {
  adult_attested_at: string | null;
  adult_attestation_version: string | null;
  eligible: boolean;
};

export type SafetySubmission = {
  min_age: number | null;
  max_age: number | null;
  guardian_presence: "required" | "not_required" | null;
  participation_rules: string;
  hazards: string;
  equipment: string;
  prerequisites: string;
  supervision_plan: string;
  credentials_evidence: string;
  insurance_evidence: string;
  venue_evidence: string;
  emergency_plan: string;
  evidence_expires_on: string | null;
};

export type ListingSafetySubmission = SafetySubmission & {
  listing_id: string;
  revision: number;
  review_status: "pending" | "approved" | "rejected";
  reviewed_revision: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** The host can read this feedback; internal notes belong in the admin review. */
  review_note: string;
  valid_until: string | null;
  minor_without_guardian_approved: boolean;
  created_at: string;
  updated_at: string;
};

/** Only these reviewed fields are visible to the public. */
export type ParticipationRules = {
  revision: number;
  min_age: number;
  max_age: number;
  guardian_presence: "required" | "not_required";
  participation_rules: string;
  hazards: string;
  equipment: string;
  prerequisites: string;
  supervision_plan: string;
  valid_until: string;
};

export type ParticipantInput = {
  kind: "self" | "minor";
  age_at_experience: number;
  adult_booker_confirmed: true;
  rules_accepted: true;
  guardian_authority_confirmed: boolean;
  guardian_presence_accepted: boolean;
  rules_revision: number;
};

export type BookingParticipation = Omit<ParticipantInput, "rules_revision"> & {
  rules_snapshot: ParticipationRules;
  account_attestation_version: string;
  accepted_at: string;
};

/** Ages are assessed at the experience date; no names or birth dates are stored. */
export type PartyMember = {
  kind: "adult" | "minor" | "guardian";
  age_at_experience: number;
};

/** Booking permission is not a waiver on behalf of another adult. */
export type GroupParticipantInput = {
  members: PartyMember[];
  adult_booker_confirmed: true;
  rules_accepted: true;
  guardian_authority_confirmed: boolean;
  guardian_presence_accepted: boolean;
  group_authority_confirmed: boolean;
  rules_revision: number;
};

export type BookingPartyParticipation = {
  members: PartyMember[];
  group_authority_confirmed: boolean;
  accepted_at: string;
};
