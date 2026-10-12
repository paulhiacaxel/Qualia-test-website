"use client";

import { useActionState, useState } from "react";
import { saveListingSafety, type SafetySaveState } from "@/app/host/safety-actions";
import { RequiredMark } from "@/components/host/required-field";
import type { ListingSafetySubmission } from "@/lib/participation/types";

const publicFields = [
  {
    name: "participation_rules",
    label: "Who can take part",
    hint: "Explain the approved activity you are proposing, age suitability and any limits. A proposed age range still needs Qualia’s approval.",
  },
  {
    name: "hazards",
    label: "Risks guests should understand",
    hint: "Describe the actual risks: for example heat, knives, water, tools, physical exertion or allergens. If none are relevant, explain why.",
  },
  {
    name: "equipment",
    label: "Equipment and what to bring",
    hint: "State the protective equipment you provide, what the guest must bring, and how you check its suitability.",
  },
  {
    name: "prerequisites",
    label: "Experience and other requirements",
    hint: "Explain any prior skill, physical ability or access requirements and how guests can discuss accommodations. Do not collect medical records here.",
  },
  {
    name: "supervision_plan",
    label: "Supervision and guardian arrangements",
    hint: "For minors, explain supervision, guardian presence and handover arrangements. For an adult-only activity, state that clearly.",
  },
] as const;

const evidenceFields = [
  {
    name: "credentials_evidence",
    label: "Qualifications and licenses",
    hint: "Identify relevant training, licenses, issuer and expiry. Include references or access-controlled document links for Qualia. If none are required, explain the basis.",
  },
  {
    name: "insurance_evidence",
    label: "Insurance evidence and scope",
    hint: "Describe the insurer, policy reference, covered activity, participant ages and venue, and any exclusions. Identify anything unconfirmed. This information does not establish verified coverage.",
  },
  {
    name: "venue_evidence",
    label: "Permission to use the venue",
    hint: "Explain who controls the location and the permission or permits for this specific activity. State any restrictions.",
  },
  {
    name: "emergency_plan",
    label: "Emergency and stop conditions",
    hint: "Explain how you stop an unsafe session, respond to an incident and contact emergency services. Include weather or equipment limits where relevant. Do not include a guest’s private information.",
  },
] as const;

function initialValues(submission: ListingSafetySubmission | null): Record<string, string> {
  return {
    min_age: submission?.min_age?.toString() ?? "",
    max_age: submission?.max_age?.toString() ?? "",
    guardian_presence: submission?.guardian_presence ?? "",
    evidence_expires_on: submission?.evidence_expires_on ?? "",
    ...Object.fromEntries(
      [...publicFields, ...evidenceFields].map(({ name }) => [name, submission?.[name] ?? ""]),
    ),
  };
}

export function HostSafetyForm({
  listingId,
  submission,
  disabled = false,
}: {
  listingId: string;
  submission: ListingSafetySubmission | null;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<SafetySaveState, FormData>(saveListingSafety, {});
  const [initialRevision] = useState(submission?.revision ?? null);
  const expectedRevision = state.savedRevision ?? initialRevision;
  const revisionChanged = (submission?.revision ?? 0) > (expectedRevision ?? 0);
  // Controlled fields preserve the host’s writing if validation or a revision check fails.
  const [values, setValues] = useState(() => initialValues(submission));
  const setValue = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  return (
    <form action={action} className="form-stack host-form">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="expectedRevision" value={expectedRevision ?? ""} />
      <p className="field-hint">
        <RequiredMark /> Required before you submit for review. You can save an incomplete draft. If
        a requirement does not apply, explain why rather than leaving it blank.
      </p>
      {submission ? (
        <p className="notice">
          Saved version {submission.revision} · Participation review: {submission.review_status}.
          {submission.valid_until
            ? ` Approval expires ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(submission.valid_until))} Miami time.`
            : ""}
        </p>
      ) : null}
      {submission?.review_note ? (
        <div className="notice">
          <strong>Participation review feedback</strong>
          <p className="preview-prose">{submission.review_note}</p>
        </div>
      ) : null}
      {revisionChanged ? (
        <p className="form-error" role="alert">
          A newer version was saved elsewhere. Copy any unsaved writing below, then reload this page
          before editing the current version.
        </p>
      ) : null}
      <fieldset
        className="unstyled-fieldset form-stack"
        disabled={disabled || pending || revisionChanged}
      >
        <legend className="field-label">Guest-facing participation details</legend>
        <p className="field-hint">
          These proposed details appear to guests only after approval and publication.
        </p>
        <div className="field-row">
          <div>
            <label className="field-label" htmlFor="safety-min-age">
              Minimum participant age <RequiredMark />
            </label>
            <input
              id="safety-min-age"
              name="min_age"
              type="number"
              min={0}
              max={120}
              step={1}
              className="field-input"
              value={values.min_age}
              onChange={(event) => setValue("min_age", event.target.value)}
              aria-describedby="safety-age-help"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="safety-max-age">
              Maximum participant age <RequiredMark />
            </label>
            <input
              id="safety-max-age"
              name="max_age"
              type="number"
              min={0}
              max={120}
              step={1}
              className="field-input"
              value={values.max_age}
              onChange={(event) => setValue("max_age", event.target.value)}
              aria-describedby="safety-age-help"
            />
          </div>
        </div>
        <p id="safety-age-help" className="field-hint">
          Enter ages in completed years, from 0 to 120. Adult account holders book for eligible
          minors; children do not create accounts.
        </p>
        <div>
          <label className="field-label" htmlFor="safety-guardian">
            Guardian presence for a minor <RequiredMark />
          </label>
          <select
            id="safety-guardian"
            name="guardian_presence"
            className="field-input"
            value={values.guardian_presence}
            onChange={(event) => setValue("guardian_presence", event.target.value)}
            aria-describedby="safety-guardian-help"
          >
            <option value="">Choose a proposed rule</option>
            <option value="required">Guardian must remain present</option>
            <option value="not_required">Guardian presence is not proposed</option>
          </select>
          <p id="safety-guardian-help" className="field-hint">
            Minors without a guardian present require an express, separate Qualia approval of the
            supervision plan. For an adult-only age range, select “not proposed” and explain that
            below.
          </p>
        </div>
        {publicFields.map(({ name, label, hint }) => (
          <div key={name}>
            <label className="field-label" htmlFor={`safety-${name}`}>
              {label} <RequiredMark />
            </label>
            <textarea
              id={`safety-${name}`}
              name={name}
              className="field-input field-textarea"
              rows={4}
              maxLength={4000}
              value={values[name]}
              onChange={(event) => setValue(name, event.target.value)}
              aria-describedby={`safety-${name}-help`}
            />
            <p id={`safety-${name}-help`} className="field-hint">
              {hint}
            </p>
          </div>
        ))}
        <h3>Private information for Qualia’s reviewer</h3>
        <p className="field-hint">
          These evidence notes stay in the private host and admin workspace. Do not paste passwords,
          identity documents or medical records. Save only the information needed to assess the
          activity.
        </p>
        {evidenceFields.map(({ name, label, hint }) => (
          <div key={name}>
            <label className="field-label" htmlFor={`safety-${name}`}>
              {label} <RequiredMark />
            </label>
            <textarea
              id={`safety-${name}`}
              name={name}
              className="field-input field-textarea"
              rows={4}
              maxLength={4000}
              value={values[name]}
              onChange={(event) => setValue(name, event.target.value)}
              aria-describedby={`safety-${name}-help`}
            />
            <p id={`safety-${name}-help`} className="field-hint">
              {hint}
            </p>
          </div>
        ))}
        <div>
          <label className="field-label" htmlFor="safety-evidence-expiry">
            Earliest evidence expiry (optional)
          </label>
          <input
            id="safety-evidence-expiry"
            name="evidence_expires_on"
            type="date"
            className="field-input"
            value={values.evidence_expires_on}
            onChange={(event) => setValue("evidence_expires_on", event.target.value)}
            aria-describedby="safety-evidence-expiry-help"
          />
          <p id="safety-evidence-expiry-help" className="field-hint">
            Use the earliest expiry among required credentials, coverage or permissions. Explain
            individual dates in the notes. Leave this empty only if no evidence has an expiry or the
            dates are not known yet.
          </p>
        </div>
        {!disabled ? (
          <div>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save participation and safety draft"}
            </button>
          </div>
        ) : null}
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
  );
}
