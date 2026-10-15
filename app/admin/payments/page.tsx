import Link from "next/link";
import { randomUUID } from "node:crypto";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPaymentControl } from "@/components/payments/admin-payment-controls";
import { requireAdmin } from "@/lib/auth/session";
import { paymentConfig } from "@/lib/payments/config";
import { paymentCommand } from "@/lib/payments/store";
import { adminPaymentsSchema } from "@/lib/payments/read-models";
import { formatMoney } from "@/lib/host/validation";
export const metadata = { title: "Payment operations" };
export default async function AdminPaymentsPage() {
  const user = await requireAdmin();
  const config = paymentConfig(process.env, true);
  const data = config
    ? adminPaymentsSchema.parse(
        await paymentCommand("pay_read_admin", {
          p_actor_id: user.id,
          p_environment: config.environment,
        }),
      )
    : null;
  return (
    <DashboardShell title="Payments need a clear record." eyebrow="Owner operations">
      <AdminNav active="payments" />
      <section className="panel">
        <h2>Settlement queue</h2>
        <p>
          {config
            ? `Environment: ${config.environment}.`
            : "Stripe is not configured. No payment actions are available."}{" "}
          Payments, host transfers, recovery and bank payouts each have their own status.
        </p>
        <p>
          Mark completed experiences after verifying delivery, then release eligible earnings. A
          payout delay or financial hold can block release. Review unknown results against Stripe
          before retrying the same operation.
        </p>
        <Link href="/admin/commercial">Review commercial terms</Link>
      </section>
      {!data?.attempts.length ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <p>No payments recorded.</p>
        </section>
      ) : (
        <div className="dashboard-grid" style={{ marginTop: 24 }}>
          {data.attempts.map((a) => (
            <article className="panel" key={a.id}>
              <h2>{formatMoney(a.amount_cents)}</h2>
              <p>
                Payment {a.state} · Booking {a.booking_status.replaceAll("_", " ")}
              </p>
              <p className="field-hint">
                Booking {a.booking_id} · Experience ended / ends{" "}
                {new Date(a.booking_ends_at).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                })}{" "}
                Miami time
              </p>
              <p className="field-hint">Attempt {a.id}</p>
              {a.quarantine_reason ? (
                <p role="status" className="form-error">
                  Review hold: {a.quarantine_reason}. Audit this payment and transfers in Stripe
                  before any further release.
                </p>
              ) : null}
              {a.session_id ? (
                <>
                  <AdminPaymentControl
                    bookingId={a.booking_id}
                    operationId={a.id}
                    action="reconcile"
                    label="Reconcile checkout"
                  />
                  {["preparing", "open", "processing"].includes(a.state) ? (
                    <AdminPaymentControl
                      bookingId={a.booking_id}
                      operationId={a.id}
                      action="expire"
                      label="Close checkout and reconcile"
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <p>
                    Checkout has no saved provider reference. Keep this attempt reserved until its
                    creation result is reconciled.
                  </p>
                  <AdminPaymentControl
                    bookingId={a.booking_id}
                    operationId={a.id}
                    action="recover"
                    label="Recover and reconcile checkout"
                  />
                </>
              )}
              {a.state === "paid" &&
              a.booking_status === "confirmed" &&
              new Date(a.booking_ends_at).getTime() <= Date.now() ? (
                <AdminPaymentControl
                  bookingId={a.booking_id}
                  operationId={randomUUID()}
                  action="complete"
                  label="Mark experience complete"
                />
              ) : null}
              {a.state === "paid" && a.booking_status === "completed" ? (
                <AdminPaymentControl
                  bookingId={a.booking_id}
                  attemptId={a.id}
                  operationId={randomUUID()}
                  action="release"
                  label="Release eligible host earnings"
                />
              ) : null}
              {["paid", "quarantined"].includes(a.state) ? (
                <details style={{ marginTop: 16 }}>
                  <summary>Issue a customer refund</summary>
                  <AdminPaymentControl
                    bookingId={a.booking_id}
                    operationId={randomUUID()}
                    attemptId={a.id}
                    action="refund"
                    label="Submit refund"
                  />
                </details>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Transfers, refunds and recovery</h2>
        {!data?.operations.length ? (
          <p>No settlement operations.</p>
        ) : (
          data.operations.map((o) => (
            <article key={o.operation_id} style={{ marginTop: 24 }}>
              <p>
                {o.kind} · {formatMoney(o.amount_cents)} · {o.state}
              </p>
              <p className="field-hint">Operation {o.operation_id}</p>
              {o.booking_id ? <p className="field-hint">Booking {o.booking_id}</p> : null}
              {o.state !== "succeeded" && o.booking_id ? (
                <AdminPaymentControl
                  bookingId={o.booking_id}
                  operationId={o.operation_id}
                  action="resume"
                  label="Reconcile or resume this operation"
                />
              ) : null}
            </article>
          ))
        )}
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Disputes</h2>
        <p>Resolve evidence and host recovery in Stripe. An open or lost dispute blocks release.</p>
        {!data?.disputes.length ? (
          <p>No disputes recorded.</p>
        ) : (
          <ul>
            {data.disputes.map((d) => (
              <li key={d.dispute_id}>
                {d.dispute_id} · {formatMoney(d.amount_cents)} · {d.state}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Bank payout status</h2>
        {!data?.payouts.length ? (
          <p>No bank payouts recorded.</p>
        ) : (
          <ul>
            {data.payouts.map((p) => (
              <li key={p.payout_id}>
                {p.payout_id} · {formatMoney(p.amount_cents)} · {p.state}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}
