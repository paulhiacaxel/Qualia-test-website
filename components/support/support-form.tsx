"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createSupportRequest, respondToSupport } from "@/app/contact/actions";
import type { SupportRequest, SupportState } from "@/lib/support/types";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function SupportForm({ request }: { request?: SupportRequest }) {
  const [state, action] = useActionState<SupportState, FormData>(
    request ? respondToSupport : createSupportRequest,
    {},
  );
  return (
    <form action={action} className="form-stack">
      {request ? (
        <>
          <input type="hidden" name="id" value={request.id} />
          <label className="field-label" htmlFor={`response-${request.id}`}>
            Response to this member
          </label>
          <textarea
            className="field-input"
            id={`response-${request.id}`}
            name="response"
            rows={5}
            required
            minLength={3}
            maxLength={5000}
            defaultValue={request.response ?? ""}
          />
          <label>
            <input type="checkbox" name="close" defaultChecked={request.status === "closed"} /> Mark
            this request closed
          </label>
        </>
      ) : (
        <>
          <div>
            <label className="field-label" htmlFor="support-subject">
              What can we help with?
            </label>
            <input
              className="field-input"
              id="support-subject"
              name="subject"
              required
              minLength={3}
              maxLength={120}
              placeholder="A booking, hosting, or an experience idea"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="support-message">
              Your message
            </label>
            <textarea
              className="field-input"
              id="support-message"
              name="message"
              rows={6}
              required
              minLength={20}
              maxLength={3000}
              placeholder="Tell us what you have in mind."
            />
          </div>
          <p className="field-hint">
            You can return to this page to read the response. Please leave payment-card details out
            of your message.
          </p>
        </>
      )}
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
      <Submit label={request ? "Save response" : "Send request to Qualia"} />
    </form>
  );
}
