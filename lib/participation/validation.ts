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
