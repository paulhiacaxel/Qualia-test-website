import assert from "node:assert/strict";
import { test } from "node:test";
import {
  safetySubmissionSchema,
  safetySubmissionComplete,
  safetyReviewSchema,
  participantSchema,
} from "../../lib/participation/validation.ts";

const submission = {
  min_age: 12,
  max_age: 120,
  guardian_presence: "required",
  participation_rules: "Follow the reviewed studio rules.",
  hazards: "Sharp tools remain with the instructor.",
  equipment: "Eye protection supplied.",
  prerequisites: "No previous experience needed.",
  supervision_plan: "Guardian remains throughout the session.",
  credentials_evidence: "Synthetic credential reference for tests.",
  insurance_evidence: "Synthetic insurance scope and expiry reference.",
  venue_evidence: "Synthetic venue permission reference.",
  emergency_plan: "Stop activity and contact emergency services as needed.",
  evidence_expires_on: "2027-12-31",
};

test("safety drafts can remain incomplete but cannot count as ready for review", () => {
  const incomplete = { ...submission, min_age: null, insurance_evidence: "" };
  assert.equal(safetySubmissionSchema.safeParse(incomplete).success, true);
  assert.equal(safetySubmissionComplete(incomplete), false);
  assert.equal(safetySubmissionComplete(null), false);
  assert.equal(
    safetySubmissionComplete({ ...submission, revision: 2, review_status: "pending" }),
    true,
  );
  assert.equal(
    safetySubmissionSchema.safeParse({ ...submission, hazards: "x".repeat(4001) }).success,
    false,
  );
});

test("participant age and safety range validation reject coercion, reversed ages and bad dates", () => {
  for (const patch of [
    { min_age: "" },
    { min_age: 21, max_age: 18 },
    { max_age: 121 },
    { evidence_expires_on: "2027-02-30" },
  ]) {
    assert.equal(safetySubmissionSchema.safeParse({ ...submission, ...patch }).success, false);
  }
  const participant = {
    kind: "minor",
    age_at_experience: 12,
    adult_booker_confirmed: true,
    rules_accepted: true,
    guardian_authority_confirmed: true,
    guardian_presence_accepted: true,
    rules_revision: 1,
  };
  assert.equal(participantSchema.safeParse(participant).success, true);
  for (const patch of [
    { age_at_experience: "" },
    { age_at_experience: null },
    { age_at_experience: 18 },
    { adult_booker_confirmed: false },
    { guardian_authority_confirmed: false },
    { rules_accepted: false },
    { rules_revision: 0 },
    { child_name: "Unnecessary personal data" },
  ]) {
    assert.equal(participantSchema.safeParse({ ...participant, ...patch }).success, false);
  }
  assert.equal(
    participantSchema.safeParse({ ...participant, kind: "self", age_at_experience: 17 }).success,
    false,
  );
  assert.equal(
    participantSchema.safeParse({
      ...participant,
      kind: "self",
      age_at_experience: 18,
      guardian_authority_confirmed: false,
      guardian_presence_accepted: false,
    }).success,
    true,
  );
});

test("activity approval requires a revision, explanation and explicit expiry", () => {
  const review = {
    listingId: "20000000-0000-4000-8000-000000000001",
    expectedRevision: 1,
    decision: "approved",
    reviewNote: "Reviewed the submitted evidence.",
    validUntil: "2027-12-31T00:00:00Z",
    minorWithoutGuardianApproved: false,
  };
  assert.equal(safetyReviewSchema.safeParse(review).success, true);
  assert.equal(safetyReviewSchema.safeParse({ ...review, validUntil: null }).success, false);
  assert.equal(
    safetyReviewSchema.safeParse({ ...review, decision: "rejected", validUntil: null }).success,
    true,
  );
});
