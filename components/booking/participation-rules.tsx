import type { ParticipationRules } from "@/lib/participation/types";

/** Public, reviewed instructions only. Host evidence and admin notes stay private. */
export function ParticipationRulesSummary({ rules }: { rules: ParticipationRules }) {
  return (
    <div className="form-stack">
      <p>
        <strong>
          {rules.min_age === rules.max_age
            ? `Age ${rules.min_age}`
            : `Ages ${rules.min_age}–${rules.max_age}`}{" "}
          at the experience
        </strong>
        {rules.min_age < 18 ? (
          <>
            . For a minor,{" "}
            {rules.guardian_presence === "required"
              ? "a parent or legal guardian must remain present."
              : "follow the supervision arrangements below; guardian presence is not required."}
          </>
        ) : (
          ". This experience is for adults."
        )}
      </p>
      <dl className="booking-details">
        <div>
          <dt>Participation rules</dt>
          <dd className="experience-prose">{rules.participation_rules}</dd>
        </div>
        <div>
          <dt>Activity risks</dt>
          <dd className="experience-prose">{rules.hazards}</dd>
        </div>
        <div>
          <dt>Equipment</dt>
          <dd className="experience-prose">{rules.equipment}</dd>
        </div>
        <div>
          <dt>Before you join</dt>
          <dd className="experience-prose">{rules.prerequisites}</dd>
        </div>
        <div>
          <dt>Supervision</dt>
          <dd className="experience-prose">{rules.supervision_plan}</dd>
        </div>
      </dl>
    </div>
  );
}
