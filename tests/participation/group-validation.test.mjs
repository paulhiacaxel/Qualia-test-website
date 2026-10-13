import assert from "node:assert/strict";
import { test } from "node:test";
import { groupParticipantSchema } from "../../lib/participation/validation.ts";

const party = {
  members: [
    { kind: "adult", age_at_experience: 30 },
    { kind: "minor", age_at_experience: 12 },
  ],
  adult_booker_confirmed: true,
  rules_accepted: true,
  guardian_authority_confirmed: true,
  guardian_presence_accepted: true,
  group_authority_confirmed: true,
  rules_revision: 1,
};

test("mixed parties require authority and supervision for every minor", () => {
  assert.equal(groupParticipantSchema.safeParse(party).success, true);
  for (const field of [
    "adult_booker_confirmed",
    "rules_accepted",
    "guardian_authority_confirmed",
    "guardian_presence_accepted",
    "group_authority_confirmed",
  ]) {
    assert.equal(groupParticipantSchema.safeParse({ ...party, [field]: false }).success, false);
  }
});

test("every guest is age-checked and extra personal data is rejected", () => {
  for (const member of [
    { kind: "adult", age_at_experience: 17 },
    { kind: "minor", age_at_experience: 18 },
    { kind: "minor", age_at_experience: "12" },
    { kind: "adult", age_at_experience: 30, name: "Not required" },
  ]) {
    assert.equal(
      groupParticipantSchema.safeParse({ ...party, members: [party.members[0], member] }).success,
      false,
    );
  }
  assert.equal(groupParticipantSchema.safeParse({ ...party, members: [] }).success, false);
  assert.equal(
    groupParticipantSchema.safeParse({ ...party, members: Array(51).fill(party.members[0]) })
      .success,
    false,
  );
});

test("adult-only parties do not need guardian attestations", () => {
  assert.equal(
    groupParticipantSchema.safeParse({
      ...party,
      members: [party.members[0], party.members[0]],
      guardian_authority_confirmed: false,
      guardian_presence_accepted: false,
    }).success,
    true,
  );
});

test("accompanying guardians must be adults with a minor in their party", () => {
  assert.equal(
    groupParticipantSchema.safeParse({
      ...party,
      members: [{ kind: "guardian", age_at_experience: 35 }, party.members[1]],
    }).success,
    true,
  );
  assert.equal(
    groupParticipantSchema.safeParse({
      ...party,
      members: [{ kind: "guardian", age_at_experience: 17 }, party.members[1]],
    }).success,
    false,
  );
  assert.equal(
    groupParticipantSchema.safeParse({
      ...party,
      members: [{ kind: "guardian", age_at_experience: 35 }, party.members[0]],
    }).success,
    false,
  );
});
