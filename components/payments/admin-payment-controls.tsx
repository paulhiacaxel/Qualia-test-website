"use client";
import { useActionState } from "react";
import { administerPayment } from "@/lib/payments/admin-actions";
export function AdminPaymentControl({
  bookingId,
  operationId,
  attemptId,
  action,
  label,
}: {
  bookingId: string;
  operationId: string;
  attemptId?: string;
  action: "complete" | "release" | "refund" | "reconcile" | "expire" | "resume" | "recover";
  label: string;
}) {
  const [state, handler, pending] = useActionState(administerPayment, {});
  return (
    <form action={handler} className="form-stack" style={{ marginTop: 16 }}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="action" value={action} />
      {attemptId ? <input type="hidden" name="attemptId" value={attemptId} /> : null}
      {action === "recover" ? (
        <label>
          Verified Stripe Checkout Session ID
          <input name="sessionId" required placeholder="cs_test_…" autoComplete="off" />
          <span className="field-hint">
            Find the session with this attempt ID in its Qualia metadata. The server verifies the
            match.
          </span>
        </label>
      ) : null}
      {action === "resume" ? (
        <details>
          <summary>Recover a provider reference after a network error</summary>
          <label>
            Stripe operation ID (optional)
            <input name="externalId" placeholder="tr_…, re_… or trr_…" autoComplete="off" />
            <span className="field-hint">
              Only a canonical operation with matching Qualia metadata and amount can be attached.
              Leave blank to reconcile the saved reference.
            </span>
          </label>
        </details>
      ) : null}
      {action === "refund" ? (
        <>
          <label>
            Refund amount (USD)
            <input name="amount" inputMode="decimal" placeholder="0.00" required />
          </label>
          <label>
            Reason
            <textarea name="reason" minLength={3} maxLength={1000} required />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" required /> I have reviewed this refund amount and cancellation
            terms.
          </label>
        </>
      ) : null}
      {action === "release" ? (
        <label className="checkbox-label">
          <input type="checkbox" required /> I have verified completion and reviewed this release.
        </label>
      ) : null}
      <button className="btn btn-outline btn-sm" type="submit" disabled={pending}>
        {pending ? "Checking…" : label}
      </button>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p role="status">{state.success}</p> : null}
    </form>
  );
}
