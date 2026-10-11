"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { reviewListing } from "@/app/admin/actions";
import type { ReviewAction, ReviewDetail, ReviewState } from "@/lib/admin/types";
import styles from "./admin.module.css";

const labels: Record<ReviewAction, string> = {
  start_review: "Start safety review",
  approve_safety: "Approve safety review",
  reject: "Reject / return for changes",
  require_consultation: "Require a consultation",
  schedule_consultation: "Record consultation appointment",
  complete_consultation: "Mark consultation completed",
  waive_consultation: "Waive consultation",
  publish: "Approve and publish listing",
  pause: "Pause live listing",
};
const hints: Record<ReviewAction, string> = {
  start_review: "Move this submission into active review. The listing stays private.",
  approve_safety:
    "Record your checks and evidence. A consultation decision is still required before publication.",
  reject:
    "The host can edit and resubmit. A fresh safety review and consultation decision will be required.",
  require_consultation:
    "The listing stays private until the consultation is completed or explicitly waived.",
  schedule_consultation:
    "Record a time already agreed with the host. This does not send an invitation or email.",
  complete_consultation:
    "Record what you discussed after the scheduled time has arrived. Publication remains a separate decision.",
  waive_consultation:
    "Explain why a call is unnecessary for this listing. Publication remains a separate decision.",
  publish:
    "Make the reviewed listing public. Its host, photos, location, and future availability are checked again.",
  pause:
    "Remove this listing from public browsing. Existing bookings are not cancelled by this action.",
};
const categoryPrompts: Record<string, string> = {
  cooking:
    "Consider allergy communication, food handling, kitchen suitability, heat, knives, and the host’s stated scope.",
  sailing:
    "Consider operator qualifications, vessel suitability, weather limits, passenger safety, and required safety equipment.",
  photography:
    "Consider location access, any needed permissions, equipment, transport, and boundaries during portrait sessions.",
  language:
    "Consider teaching experience, learning goals, meeting setting, accessibility, and guest/host boundaries.",
  music:
    "Consider teaching experience, sound levels, instruments, studio access, and the intended skill level.",
  art: "Consider tools, materials, ventilation, protective equipment, studio access, and the host’s teaching experience.",
  fitness:
    "Consider qualifications, activity intensity, guest screening, accessibility, equipment, and limits on health claims.",
};

function availableActions(item: ReviewDetail["listing"]): ReviewAction[] {
  if (item.status === "published") return ["pause"];
  if (item.status === "paused") return ["reject"];
  if (item.status === "rejected") return [];
  const actions: ReviewAction[] = [];
  if (item.status === "submitted") actions.push("start_review");
  if (item.safety_status === "pending") actions.push("approve_safety");
  if (item.safety_status === "approved") {
    if (["not_requested", "waived"].includes(item.consultation_status))
      actions.push("require_consultation");
    if (["required", "scheduled"].includes(item.consultation_status))
      actions.push("schedule_consultation");
    if (item.consultation_status === "scheduled") actions.push("complete_consultation");
    if (["not_requested", "required", "scheduled"].includes(item.consultation_status))
      actions.push("waive_consultation");
    if (item.status === "approved" && ["completed", "waived"].includes(item.consultation_status))
      actions.push("publish");
  }
  actions.push("reject");
  return actions;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending} type="submit">
      {pending ? "Saving decision…" : label}
    </button>
  );
}

export function ReviewForm({ listing, review }: Pick<ReviewDetail, "listing" | "review">) {
  const [state, action] = useActionState<ReviewState, FormData>(reviewListing, {});
  const choices = availableActions(listing);
  const [chosen, setChosen] = useState<ReviewAction>(choices[0] ?? "start_review");
  // A server revalidation may remove the previously selected transition.
  const selected = choices.includes(chosen) ? chosen : choices[0];
  if (!selected)
    return (
      <p className={styles.callout}>
        This listing is with the host for changes. Review can begin again after they resubmit it.
      </p>
    );
  return (
    <form action={action} className={styles.reviewForm}>
      <input type="hidden" name="listingId" value={listing.id} />
      <input type="hidden" name="expectedUpdatedAt" value={listing.updated_at} />
      <div>
        <label className="field-label" htmlFor="review-action">
          Review decision
        </label>
        <select
          className="field-input"
          name="action"
          id="review-action"
          value={selected}
          onChange={(event) => setChosen(event.target.value as ReviewAction)}
        >
          {choices.map((choice) => (
            <option value={choice} key={choice}>
              {labels[choice]}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.actionHint}>{hints[selected]}</p>
      {selected === "approve_safety" ? (
        <>
          <fieldset className={styles.checklist}>
            <legend>Review checks</legend>
            <label>
              <input type="checkbox" name="profile" required />I reviewed the host’s profile and
              evidence of relevant skill.
            </label>
            <label>
              <input type="checkbox" name="experience" required />I reviewed the experience scope,
              description, price, duration, and photos.
            </label>
            <label>
              <input type="checkbox" name="location" required />I reviewed the private meeting
              details and setting.
            </label>
            <label>
              <input type="checkbox" name="risks" required />I reviewed the category’s risks and any
              supporting information needed.
            </label>
          </fieldset>
          <p className={styles.callout}>
            {categoryPrompts[listing.category]} These prompts support an operational review; they do
            not verify licenses, insurance, or legal compliance automatically.
          </p>
          <div>
            <label htmlFor="risk-notes" className="field-label">
              Risk and evidence notes · internal
            </label>
            <textarea
              id="risk-notes"
              name="riskNotes"
              className="field-input"
              maxLength={4000}
              required
              defaultValue={review?.risk_notes ?? ""}
              placeholder="What did you review, what evidence supports it, and what limitations remain?"
            />
          </div>
        </>
      ) : null}
      {selected === "schedule_consultation" ? (
        <div>
          <label className="field-label" htmlFor="consultation-time">
            Agreed appointment · Miami time
          </label>
          <input
            className="field-input"
            id="consultation-time"
            type="datetime-local"
            name="scheduledLocal"
            required
          />
          <p className="field-hint">
            America/New_York, including daylight saving. Ambiguous clock-change times are rejected.
          </p>
        </div>
      ) : null}
      {["reject", "pause"].includes(selected) ? (
        <div>
          <label className="field-label" htmlFor="host-feedback">
            Message visible to the host
          </label>
          <textarea
            className="field-input"
            id="host-feedback"
            name="hostFeedback"
            required
            minLength={3}
            maxLength={3000}
            placeholder="Explain the decision and the concrete changes needed."
          />
        </div>
      ) : null}
      <div>
        <label className="field-label" htmlFor="decision-note">
          Decision reason · internal audit record
        </label>
        <textarea
          className="field-input"
          name="note"
          id="decision-note"
          required
          minLength={3}
          maxLength={3000}
        />
      </div>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="notice success" role="status">
          {state.success}
        </p>
      ) : null}
      <Submit label={labels[selected]} />
    </form>
  );
}
