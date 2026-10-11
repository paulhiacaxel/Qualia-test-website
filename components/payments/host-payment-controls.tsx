"use client";
import { useActionState } from "react";
import {
  startHostOnboarding,
  openHostPaymentDashboard,
  refreshHostPaymentStatus,
} from "@/lib/payments/actions";
import type { PaymentActionState } from "@/lib/payments/contracts";
function Control({
  handler,
  children,
}: {
  handler: (state: PaymentActionState, form: FormData) => Promise<PaymentActionState>;
  children: string;
}) {
  const [state, action, pending] = useActionState(handler, {});
  return (
    <form action={action}>
      <button className="btn btn-outline" disabled={pending}>
        {pending ? "Please wait…" : children}
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
export function HostPaymentControls() {
  return (
    <div className="button-row">
      <Control handler={startHostOnboarding}>Set up or update payments</Control>
      <Control handler={refreshHostPaymentStatus}>Refresh status</Control>
      <Control handler={openHostPaymentDashboard}>Open Stripe dashboard</Control>
    </div>
  );
}
