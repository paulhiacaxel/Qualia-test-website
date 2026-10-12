"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { CommercialPolicy } from "@/lib/admin/commercial-validation";
import {
  disablePayments,
  enrollFounder,
  grantReferral,
  saveCommercialPolicy,
  type CommercialState,
} from "./actions";
import styles from "@/components/admin/admin.module.css";

function Result({ state }: { state: CommercialState }) {
  return (
    <>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="notice success" role="status">
          {state.success}
        </p>
      )}
    </>
  );
}
function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function CommercialForm({
  environment,
  current,
}: {
  environment: "sandbox" | "live";
  current: CommercialPolicy;
}) {
  const [state, action] = useActionState<CommercialState, FormData>(saveCommercialPolicy, {});
  const policy = current.policy;
  return (
    <form action={action} className={styles.reviewForm}>
      <input type="hidden" name="environment" value={environment} />
      <div className="dashboard-grid">
        {(
          [
            [
              "standard_fee_bps",
              "Standard commission · %",
              policy ? policy.standard_fee_bps / 100 : "",
              100,
              "0.01",
            ],
            [
              "founder_fee_bps",
              "Lifetime founding commission · %",
              policy ? policy.founder_fee_bps / 100 : "",
              100,
              "0.01",
            ],
            [
              "founder_free_bookings",
              "Founding commission-free paid bookings · 0 means none",
              policy?.founder_free_bookings ?? "",
              100,
              "1",
            ],
            [
              "founder_duration_months",
              "Founding credit period · calendar months",
              policy?.founder_duration_months ?? "",
              24,
              "1",
            ],
            [
              "founder_cohort_cap",
              "Founding host cohort cap · all policy versions",
              policy?.founder_cohort_cap ?? "",
              10000,
              "1",
            ],
            [
              "payout_delay_hours",
              "Transfer delay after completion · hours",
              policy?.payout_delay_hours ?? "",
              720,
              "1",
            ],
            [
              "referral_free_bookings",
              "Free bookings per qualified referral",
              policy?.referral_free_bookings ?? "",
              10,
              "1",
            ],
            [
              "referral_credit_cap",
              "Lifetime referral credit cap per host",
              policy?.referral_credit_cap ?? "",
              100,
              "1",
            ],
          ] as const
        ).map(([name, label, value, max, step]) => (
          <div key={name}>
            <label className="field-label" htmlFor={name}>
              {label}
            </label>
            <input
              className="field-input"
              id={name}
              name={name}
              type="number"
              min={name === "founder_duration_months" || name === "founder_cohort_cap" ? 1 : 0}
              max={max}
              step={step}
              required
              defaultValue={value}
            />
          </div>
        ))}
      </div>
      <label className="field-label" htmlFor="processing">
        Who pays actual card processing costs?
      </label>
      <select
        className="field-input"
        id="processing"
        name="processing_allocation"
        required
        defaultValue={policy?.processing_allocation ?? ""}
      >
        <option value="" disabled>
          Choose an allocation
        </option>
        <option value="platform_absorbs">Qualia absorbs processing costs</option>
        <option value="host_actual_cost">Deduct verified actual costs from host earnings</option>
      </select>
      <label className="field-label" htmlFor="restore">
        Restore a founding/referral credit after a full refund?
      </label>
      <select
        className="field-input"
        id="restore"
        name="restore_refunded_credit"
        required
        defaultValue={policy ? (policy.restore_refunded_credit ? "yes" : "no") : ""}
      >
        <option value="" disabled>
          Choose a refund rule
        </option>
        <option value="yes">Yes, restore the credit</option>
        <option value="no">No, keep it consumed</option>
      </select>
      <label className="field-label" htmlFor="terms-version">
        Approved terms version
      </label>
      <input
        className="field-input"
        id="terms-version"
        name="terms_version"
        required
        maxLength={100}
        defaultValue={policy?.terms_version ?? ""}
      />
      <label className="field-label" htmlFor="cancellation">
        Cancellation and refund terms shown before payment
      </label>
      <textarea
        className="field-input"
        id="cancellation"
        name="cancellation_terms"
        required
        minLength={10}
        maxLength={10000}
        rows={7}
        defaultValue={policy?.cancellation_terms ?? ""}
      />
      <fieldset className={styles.checklist}>
        <legend>Review the supported policy</legend>
        <label>
          <input type="checkbox" name="incentive_start" value="host_enrollment" required />
          Founding benefits begin at the agreed activation time recorded when a host with an
          approved live listing is enrolled.
        </label>
        <label>
          <input
            type="checkbox"
            name="cutoff_rule"
            value="checkout_before_cutoff_frozen_quote"
            required
          />
          A checkout started before the founding cutoff keeps its quoted fee while payment settles.
        </label>
        <label>
          <input
            type="checkbox"
            name="refund_rule"
            value="proportional_commission_nonrefundable_processing"
            required
          />
          Refunds return platform commission proportionally; actual processing costs follow the
          selected allocation and may not be recoverable.
        </label>
        <label>
          <input type="checkbox" name="completion_rule" value="admin_after_end" required />
          An admin confirms completion after the experience ends; transfers become eligible after
          the chosen delay.
        </label>
        <label>
          <input type="checkbox" name="liability_acknowledged" required />I approve these terms and
          understand Qualia is responsible for platform payment costs and losses under this Connect
          setup. Stripe account terms must also be accepted separately.
        </label>
        <label>
          <input type="checkbox" name="enabled" defaultChecked={current.enabled} />
          Enable new checkout under this {environment} policy.
        </label>
      </fieldset>
      <Result state={state} />
      <Submit>Save commercial policy</Submit>
    </form>
  );
}

export function IncentiveForm({
  kind,
  environment,
  policyId,
}: {
  kind: "founder" | "referral";
  environment: string;
  policyId?: string;
}) {
  const [state, action] = useActionState<CommercialState, FormData>(
    kind === "founder" ? enrollFounder : grantReferral,
    {},
  );
  return (
    <form action={action} className={styles.reviewForm}>
      <input type="hidden" name="environment" value={environment} />
      {kind === "founder" ? (
        <>
          <input type="hidden" name="policy_id" value={policyId ?? ""} />
          <label className="field-label" htmlFor="founder-host">
            Host account UUID
          </label>
          <input className="field-input" id="founder-host" name="host_id" required />
          <label className="field-label" htmlFor="founder-start">
            Agreed founding activation time · Miami time
          </label>
          <input
            className="field-input"
            id="founder-start"
            name="started_at"
            type="datetime-local"
            required
          />
          <label>
            <input type="checkbox" name="approved" required />
            The host has an approved live listing and has agreed to these founding terms and
            activation time.
          </label>
        </>
      ) : (
        <>
          <label className="field-label" htmlFor="referrer">
            Referring host UUID
          </label>
          <input className="field-input" id="referrer" name="referrer_id" required />
          <label className="field-label" htmlFor="referred-host">
            Referred host UUID
          </label>
          <input className="field-input" id="referred-host" name="referred_host_id" required />
          <label>
            <input type="checkbox" name="approved" required />I verified the referral and its first
            completed paid experience.
          </label>
        </>
      )}
      <Result state={state} />
      <Submit>{kind === "founder" ? "Enroll founding host" : "Grant referral credits"}</Submit>
    </form>
  );
}
export function PauseForm({ environment }: { environment: string }) {
  const [state, action] = useActionState<CommercialState, FormData>(disablePayments, {});
  return (
    <form action={action} className={styles.reviewForm}>
      <input type="hidden" name="environment" value={environment} />
      <Result state={state} />
      <Submit>Disable new {environment} checkout</Submit>
    </form>
  );
}
