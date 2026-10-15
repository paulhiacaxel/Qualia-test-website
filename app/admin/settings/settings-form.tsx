"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveBookingPolicy, type SettingsState } from "./actions";
import type { BookingPolicy } from "@/lib/admin/settings-validation";
import styles from "@/components/admin/admin.module.css";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving settings…" : "Save booking settings"}
    </button>
  );
}

export function SettingsForm({ policy }: { policy: BookingPolicy }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveBookingPolicy, {});
  const [enabled, setEnabled] = useState(policy.enabled);
  return (
    <form action={action} className={styles.reviewForm}>
      <div>
        <label className="field-label" htmlFor="request-expiry">
          Host response deadline · minutes
        </label>
        <input
          className="field-input"
          id="request-expiry"
          name="requestExpiryMinutes"
          type="number"
          min={1}
          max={10080}
          step={1}
          required={enabled}
          defaultValue={policy.request_expiry_minutes ?? ""}
          aria-describedby="request-hint"
        />
        <p className="field-hint" id="request-hint">
          How long a host has to respond before a guest’s request expires. Choose 1–10,080 minutes.
        </p>
      </div>
      <div>
        <label className="field-label" htmlFor="payment-deadline">
          Guest payment deadline · minutes
        </label>
        <input
          className="field-input"
          id="payment-deadline"
          name="paymentDeadlineMinutes"
          type="number"
          min={32}
          max={10080}
          step={1}
          required={enabled}
          defaultValue={policy.payment_deadline_minutes ?? ""}
          aria-describedby="payment-hint"
        />
        <p className="field-hint" id="payment-hint">
          How long a guest has to pay after the host accepts. Choose 32–10,080 minutes. A new
          checkout must be opened at least 31 minutes before this deadline; allow guests enough time
          to see the acceptance and start payment.
        </p>
      </div>
      <fieldset className={styles.checklist}>
        <legend>Accept new requests</legend>
        <label>
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable new booking requests using these deadlines.
        </label>
      </fieldset>
      <p className={styles.callout}>
        Saving deadlines alone does not open bookings. Turning requests off stops new requests;
        existing bookings keep their captured deadlines and can continue through their current
        workflow.
      </p>
      {policy.payment_deadline_minutes !== null && policy.payment_deadline_minutes < 32 ? (
        <p className="notice">
          The saved payment window is too short. New requests stay closed until you choose at least
          32 minutes. Existing deadlines have not been extended.
        </p>
      ) : null}
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
      <SaveButton />
    </form>
  );
}
