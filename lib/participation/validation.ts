import { z } from "zod";
import type { SafetySubmission } from "./types";

const draftText = z.string().trim().max(4000, "Use 4,000 characters or fewer.");
const draftAge = z.number().int().min(0).max(120).nullable();

/** Drafts can be incomplete. Submission and approval impose stronger DB checks. */
export const safetySubmissionSchema = z
  .object({
    min_age: draftAge,
    max_age: draftAge,
    guardian_presence: z.enum(["required", "not_required"]).nullable(),
    participation_rules: draftText,
    hazards: draftText,
    equipment: draftText,
    prerequisites: draftText,
    supervision_plan: draftText,
    credentials_evidence: draftText,
    insurance_evidence: draftText,
    venue_evidence: draftText,
    emergency_plan: draftText,
    evidence_expires_on: z.iso.date().nullable(),
  })
  .strict()
  .refine(
    (value) => value.min_age === null || value.max_age === null || value.max_age >= value.min_age,
    { path: ["max_age"], message: "The oldest participant must be at least the minimum age." },
  );

const requiredSafetyDetails = [
  ["min_age", "Minimum participant age", "safety-min-age"],
  ["max_age", "Maximum participant age", "safety-max-age"],
  ["guardian_presence", "Guardian presence for a minor", "safety-guardian"],
  ["participation_rules", "Who can take part", "safety-participation_rules"],
  ["hazards", "Risks guests should understand", "safety-hazards"],
  ["equipment", "Equipment and what to bring", "safety-equipment"],
  ["prerequisites", "Experience and other requirements", "safety-prerequisites"],
  ["supervision_plan", "Supervision and guardian arrangements", "safety-supervision_plan"],
  ["credentials_evidence", "Qualifications and licenses", "safety-credentials_evidence"],
  ["insurance_evidence", "Insurance evidence and scope", "safety-insurance_evidence"],
  ["venue_evidence", "Permission to use the venue", "safety-venue_evidence"],
  ["emergency_plan", "Emergency and stop conditions", "safety-emergency_plan"],
] as const;

/** Name the blank draft fields without inventing answers or weakening review checks. */
export function missingSafetyDetails(value: SafetySubmission | null) {
  return requiredSafetyDetails
    .filter(([name]) => {
      const field = value?.[name];
      return field == null || (typeof field === "string" && field.trim() === "");
    })
    .map(([, label, id]) => ({ label, href: `#${id}` }));
}

export function safetySubmissionComplete(value: SafetySubmission | null): boolean {
  if (!value) return false;
  // Read models also include reviewer metadata. Validate just the draft fields.
  const draft = Object.fromEntries(
    Object.keys(safetySubmissionSchema.shape).map((key) => [
      key,
      value[key as keyof SafetySubmission],
    ]),
  );
  if (!safetySubmissionSchema.safeParse(draft).success) return false;
  return (
    value.min_age !== null &&
    value.max_age !== null &&
    value.guardian_presence !== null &&
    [
      value.participation_rules,
      value.hazards,
      value.equipment,
      value.prerequisites,
      value.supervision_plan,
      value.credentials_evidence,
      value.insurance_evidence,
      value.venue_evidence,
      value.emergency_plan,
    ].every((field) => field.trim().length > 0)
  );
}

export const safetyReviewSchema = z
  .object({
    listingId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    decision: z.enum(["approved", "rejected"]),
    reviewNote: z
      .string()
      .trim()
      .min(3, "Explain the evidence reviewed and your decision.")
      .max(4000),
    validUntil: z.iso.datetime({ offset: true }).nullable(),
    minorWithoutGuardianApproved: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.decision === "approved" && !value.validUntil) {
      context.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Set when this review must be renewed.",
      });
    }
  });

/** These acknowledgments do not replace an activity-specific legal release. */
export const participantSchema = z
  .object({
    kind: z.enum(["self", "minor"]),
    age_at_experience: z.number().int().min(0).max(120),
    adult_booker_confirmed: z.literal(true, "Confirm you are at least 18."),
    rules_accepted: z.literal(true, "Read and accept this experience's participation rules."),
    guardian_authority_confirmed: z.boolean(),
    guardian_presence_accepted: z.boolean(),
    rules_revision: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "self" && value.age_at_experience < 18) {
      context.addIssue({
        code: "custom",
        path: ["age_at_experience"],
        message: "Adults book for themselves. A parent or legal guardian must book for a minor.",
      });
    }
    if (value.kind === "minor" && value.age_at_experience >= 18) {
      context.addIssue({
        code: "custom",
        path: ["age_at_experience"],
        message: "Use the adult option for a participant who will be 18 or older.",
      });
    }
    if (value.kind === "minor" && !value.guardian_authority_confirmed) {
      context.addIssue({
        code: "custom",
        path: ["guardian_authority_confirmed"],
        message: "Only a parent or legally authorized guardian can book for a minor.",
      });
    }
    if (value.kind === "minor" && !value.guardian_presence_accepted) {
      context.addIssue({
        code: "custom",
        path: ["guardian_presence_accepted"],
        message: "Confirm you will follow this experience's approved supervision arrangements.",
      });
    }
  });

/** Every seat has its own age check, including minors in an otherwise adult party.
 * These confirmations arrange the booking; they do not sign another adult's release. */
export const groupParticipantSchema = z
  .object({
    members: z
      .array(
        z
          .object({
            kind: z.enum(["adult", "minor", "guardian"]),
            age_at_experience: z.number().int().min(0).max(120),
          })
          .strict()
          .superRefine((member, context) => {
            if ((member.kind !== "minor") !== member.age_at_experience >= 18) {
              context.addIssue({
                code: "custom",
                path: ["age_at_experience"],
                message:
                  "Adults and accompanying guardians must be 18 or over; minors must be under 18.",
              });
            }
          }),
      )
      .min(1, "Add everyone taking part.")
      .max(50, "A booking can include up to 50 guests."),
    adult_booker_confirmed: z.literal(true, "Confirm you are at least 18."),
    rules_accepted: z.literal(true, "Read and accept this experience's participation rules."),
    guardian_authority_confirmed: z.boolean(),
    guardian_presence_accepted: z.boolean(),
    group_authority_confirmed: z.boolean(),
    rules_revision: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.members.some((member) => member.kind === "guardian") &&
      !value.members.some((member) => member.kind === "minor")
    ) {
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: "An accompanying guardian must attend with a minor in this booking.",
      });
    }
    if (value.members.length > 1 && !value.group_authority_confirmed) {
      context.addIssue({
        code: "custom",
        path: ["group_authority_confirmed"],
        message: "Confirm you have permission to arrange this group's booking.",
      });
    }
    if (value.members.some((member) => member.kind === "minor")) {
      if (!value.guardian_authority_confirmed) {
        context.addIssue({
          code: "custom",
          path: ["guardian_authority_confirmed"],
          message: "You must be a parent or legally authorized guardian for every minor you book.",
        });
      }
      if (!value.guardian_presence_accepted) {
        context.addIssue({
          code: "custom",
          path: ["guardian_presence_accepted"],
          message: "Confirm the approved supervision arrangements for every minor.",
        });
      }
    }
  });
