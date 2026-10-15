"use client";

import { useActionState, useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { HostActionState } from "@/lib/host/types";

function SubmitButton({
  label,
  danger,
  disabled = false,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
      type="submit"
      disabled={pending || disabled}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function ActionForm({
  action,
  children,
  label,
  disabled = false,
  submitDisabled = false,
  danger = false,
  className = "",
}: {
  action: (previous: HostActionState, data: FormData) => Promise<HostActionState>;
  children: ReactNode;
  label: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState<HostActionState, FormData>(action, {});
  const messageId = useId();
  return (
    <form
      action={formAction}
      className={`form-stack host-form ${className}`}
      aria-describedby={state.error ? messageId : undefined}
    >
      <fieldset className="unstyled-fieldset form-stack" disabled={disabled}>
        {children}
        {state.error ? (
          <p className="form-error" id={messageId} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="notice success" role="status">
            {state.success}
          </p>
        ) : null}
        {!disabled ? (
          <div>
            <SubmitButton label={label} danger={danger} disabled={submitDisabled} />
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
