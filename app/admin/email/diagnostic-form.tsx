"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendDiagnosticEmail } from "./actions";
import type { EmailDiagnosticState } from "@/lib/email/diagnostic";
import styles from "@/components/admin/admin.module.css";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Sending test…" : "Send a test email to my verified address"}
    </button>
  );
}

export function DiagnosticForm({ recipient }: { recipient: string }) {
  const [state, action] = useActionState<EmailDiagnosticState, FormData>(sendDiagnosticEmail, {});
  return (
    <form action={action} className={styles.reviewForm}>
      <fieldset className={styles.checklist}>
        <legend>Approve this test</legend>
        <label>
          <input type="checkbox" name="confirm" required />I reviewed the message and want to send
          it to my verified address, {recipient}.
        </label>
      </fieldset>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.providerId ? (
        <div className="notice success" role="status">
          <p>Resend accepted the test request. This does not confirm delivery to your inbox.</p>
          <p>
            Provider email ID: <code>{state.providerId}</code>
          </p>
          <p>Check the delivery status in Resend and confirm the message arrived in your inbox.</p>
        </div>
      ) : null}
      <SendButton />
    </form>
  );
}
