"use client";

import { useActionState, useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { HostActionState } from "@/lib/host/types";

function SubmitButton({ label, danger }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
      type="submit"
      disabled={pending}
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
  danger = false,
  className = "",
}: {
  action: (previous: HostActionState, data: FormData) => Promise<HostActionState>;
  children: ReactNode;
  label: string;
  disabled?: boolean;
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
            <SubmitButton label={label} danger={danger} />
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
