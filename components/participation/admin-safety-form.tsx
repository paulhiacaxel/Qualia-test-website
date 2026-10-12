"use client";

import { useActionState, useState } from "react";
import { reviewListingSafety } from "@/app/admin/safety-actions";
import { RequiredMark } from "@/components/host/required-field";
import type { ListingSafetySubmission } from "@/lib/participation/types";
import type { ReviewState } from "@/lib/admin/types";
import styles from "@/components/admin/admin.module.css";

const publicFields = [
  ["participation_rules", "Participation rules"],
  ["hazards", "Disclosed hazards"],
  ["equipment", "Equipment and what to bring"],
  ["prerequisites", "Prerequisites"],
  ["supervision_plan", "Supervision and guardian arrangements"],
] as const;
const privateFields = [
  ["credentials_evidence", "Qualifications and license evidence"],
  ["insurance_evidence", "Insurance evidence and scope"],
  ["venue_evidence", "Venue permission evidence"],
  ["emergency_plan", "Emergency and stop plan"],
] as const;

export function AdminSafetyForm({
  listingId,
  submission,
  complete,
}: {
  listingId: string;
  submission: ListingSafetySubmission | null;
  complete: boolean;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewListingSafety, {});
  const [decision, setDecision] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [minorApproval, setMinorApproval] = useState(false);
  // Never silently point an in-progress decision at a newer host submission.
  const [reviewingRevision] = useState(submission?.revision ?? null);
  if (!submission)
    return (
      <p className={styles.callout}>
        The host has not saved participation and safety details. This evidence review must be
        completed before ordinary safety approval or publication.
      </p>
    );
  const guardianException =
    submission.min_age !== null &&
    submission.min_age < 18 &&
    submission.guardian_presence === "not_required";
  const revisionChanged = reviewingRevision !== submission.revision;
  return (
    <div className={styles.stack}>
      <p className={styles.callout}>
        Version {submission.revision} · Participation review:{" "}
        <strong>{submission.review_status}</strong>.
        {submission.reviewed_revision !== null
          ? ` Reviewed version: ${submission.reviewed_revision}.`
          : ""}
        {submission.valid_until
          ? ` Valid until ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(submission.valid_until))} Miami time.`
          : ""}
      </p>
      <div>
        <h3>Proposed guest-facing rules</h3>
        <p>
          Participant ages: {submission.min_age ?? "not supplied"}–
          {submission.max_age ?? "not supplied"}.
        </p>
        <p>
          Guardian presence:{" "}
          {submission.guardian_presence === "required"
            ? "required"
            : submission.guardian_presence === "not_required"
              ? "not proposed"
              : "not supplied"}
          .
        </p>
        {publicFields.map(([name, label]) => (
          <div key={name}>
            <h4>{label}</h4>
            <p className={styles.bodyText}>{submission[name] || "Not supplied."}</p>
          </div>
        ))}
      </div>
      <div>
        <h3>Private host evidence</h3>
        <p className={styles.callout}>
          These are host-provided claims and references. Review the actual evidence for the
          activity, ages and venue. The app does not verify insurance, licenses or legal
          effectiveness automatically.
        </p>
        {privateFields.map(([name, label]) => (
          <div key={name}>
            <h4>{label}</h4>
            <p className={styles.bodyText}>{submission[name] || "Not supplied."}</p>
          </div>
        ))}
        <p>
          <strong>Earliest evidence expiry:</strong>{" "}
          {submission.evidence_expires_on ??
            "Not supplied; determine a supported review expiry before approving."}
        </p>
      </div>
      {submission.review_note ? (
        <div>
          <h3>Previous host-visible decision note</h3>
          <p className={styles.bodyText}>{submission.review_note}</p>
        </div>
      ) : null}
      <form action={action} className={styles.reviewForm}>
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="expectedRevision" value={reviewingRevision ?? ""} />
        {revisionChanged ? (
          <p className="form-error" role="alert">
            The host saved a newer version. Copy any unsaved notes, then reload and review the
            current evidence before recording a decision.
          </p>
        ) : null}
        <fieldset
          className={`unstyled-fieldset ${styles.reviewForm}`}
          disabled={pending || revisionChanged}
        >
          <legend>Review this exact version</legend>
          <p className="field-hint">
            <RequiredMark /> Required. This records a participation decision; it does not publish
            the listing or replace the remaining listing review.
          </p>
          {!complete ? (
            <p className="form-error">
              Required host details are missing. Request changes before approving this version.
            </p>
          ) : null}
          <div>
            <label className="field-label" htmlFor="participation-decision">
              Participation decision <RequiredMark />
            </label>
            <select
              id="participation-decision"
              name="decision"
              className="field-input"
              required
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
            >
              <option value="" disabled>
                Choose a decision
              </option>
              <option value="approved" disabled={!complete}>
                Approve this participation and evidence version
              </option>
              <option value="rejected">Request changes / reject this version</option>
            </select>
          </div>
          {decision === "approved" ? (
            <>
              <div>
                <label className="field-label" htmlFor="participation-valid-until">
                  Review valid until · Miami time <RequiredMark />
                </label>
                <input
                  id="participation-valid-until"
                  name="validUntil"
                  type="datetime-local"
                  className="field-input"
                  required
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                  aria-describedby="participation-expiry-help"
                />
                <p id="participation-expiry-help" className="field-hint">
                  Set a future review deadline supported by the evidence. It cannot exceed the
                  earliest evidence expiry. Each experience must end before this approval expires.
                </p>
              </div>
              {guardianException ? (
                <label className={styles.callout}>
                  <input
                    type="checkbox"
                    name="minorWithoutGuardianApproved"
                    required
                    checked={minorApproval}
                    onChange={(event) => setMinorApproval(event.target.checked)}
                  />{" "}
                  I expressly approve participation by minors without a guardian present for this
                  exact age range and supervision plan. I reviewed the supporting supervision,
                  handover, legal and insurance requirements and explain the basis below.{" "}
                  <RequiredMark />
                </label>
              ) : null}
            </>
          ) : null}
          <div>
            <label className="field-label" htmlFor="participation-review-note">
              Evidence and decision note · visible to the host <RequiredMark />
            </label>
            <textarea
              id="participation-review-note"
              name="reviewNote"
              className="field-input"
              required
              minLength={3}
              maxLength={4000}
              rows={6}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              aria-describedby="participation-note-help"
            />
            <p id="participation-note-help" className="field-hint">
              State what you checked, its source and scope, expiry and any required changes. Do not
              approve while unresolved conditions remain. Keep confidential internal notes in the
              ordinary review form.
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending
              ? "Saving participation decision…"
              : `Record decision for version ${submission.revision}`}
          </button>
        </fieldset>
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
      </form>
    </div>
  );
}
