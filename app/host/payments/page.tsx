import { foundingOfferSummary } from "@/lib/payments/incentives";
import Link from "next/link";
import { requireHost } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard-shell";
import { HostNav } from "@/components/host/host-nav";
import { HostPaymentControls } from "@/components/payments/host-payment-controls";
import { getHostPaymentAccess } from "@/lib/payments/host-access";
import { paymentCommand } from "@/lib/payments/store";
import { hostPaymentsSchema } from "@/lib/payments/read-models";
import { formatMoney } from "@/lib/host/validation";
export const metadata = { title: "Host payments" };
export default async function HostPaymentsPage() {
  const { user } = await requireHost();
  const access = await getHostPaymentAccess(user.id);
  const config = access?.config;
  const data = config
    ? hostPaymentsSchema.parse(
        await paymentCommand("pay_read_host", {
          p_actor_id: user.id,
          p_environment: config.environment,
        }),
      )
    : null;
  return (
    <DashboardShell title="Your earnings, clearly." eyebrow="Host payments">
      <HostNav current="payments" />
      <section className="panel">
        <h2>Payout setup</h2>
        {config?.environment === "sandbox" ? (
          <p className="notice">
            Sandbox testing · administrators only. These accounts cannot receive real guest
            payments.
          </p>
        ) : null}
        <p>
          {!config
            ? "Payout setup is not open yet. You can complete your profile and submit your listing for review. Qualia will let you know when secure payout setup is ready."
            : data?.account?.transfers_active && data.account.payouts_active
              ? "Your Stripe account is ready to receive transfers and bank payouts."
              : access?.canOnboard
                ? "Complete Stripe's setup and refresh your status to prepare for receiving earnings."
                : "New payout setup is temporarily paused. You can still view any existing payout account and its status."}
        </p>
        <p>
          Stripe collects payment and identity details securely. Returning from setup does not mean
          verification is complete.
        </p>
        {access ? (
          <HostPaymentControls canOnboard={access.canOnboard} hasAccount={Boolean(data?.account)} />
        ) : null}
        <p>Completing payout setup does not enable guest payments or publish your listing.</p>
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Your commission terms</h2>
        {!data?.commercial ? (
          <p>Qualia has not enabled commercial terms yet.</p>
        ) : (
          <>
            <p>
              {data.commercial.enabled ? "New bookings enabled" : "New bookings paused"} · Terms{" "}
              {data.commercial.terms_version}
            </p>
            <p>
              Standard commission: {(data.commercial.standard_fee_bps / 100).toFixed(2)}%.{" "}
              {data.commercial.processing_allocation === "platform_absorbs"
                ? "Qualia covers processing costs."
                : "Your earnings cover actual payment processing costs once Stripe confirms them."}
            </p>
            {data.commercial.founder ? (
              <>
                <p>
                  {foundingOfferSummary({
                    freeBookings: data.commercial.founder.free_booking_limit,
                    durationMonths: data.commercial.founder.duration_months,
                    lifetimeFeeBps: data.commercial.founder.lifetime_fee_bps,
                  })}{" "}
                  Agreed activation:{" "}
                  {new Date(data.commercial.founder.starts_at).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}{" "}
                  Miami time.
                  {data.commercial.founder.free_booking_limit > 0 && (
                    <>
                      {" "}
                      Unused commission-free credits expire at{" "}
                      {new Date(data.commercial.founder.ends_at).toLocaleString("en-US", {
                        timeZone: "America/New_York",
                      })}{" "}
                      Miami time.
                    </>
                  )}
                </p>
                <p>
                  Founding credits used: {data.commercial.founder_credits_consumed} · Reserved by
                  pending payments: {data.commercial.founder_credits_reserved}.
                </p>
              </>
            ) : (
              <p>You are not currently enrolled as a founding host.</p>
            )}
            <p>
              Referral credits granted: {data.commercial.referral_credits_granted} · Used or
              reserved: {data.commercial.referral_credits_used}.
            </p>
            <p>
              Earnings become eligible after Qualia confirms the experience was completed and the{" "}
              {data.commercial.payout_delay_hours}-hour post-experience delay has elapsed. A
              financial hold can delay release. Bank arrival is separate.
            </p>
            <details>
              <summary>Cancellation terms</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{data.commercial.cancellation_terms}</p>
            </details>
          </>
        )}
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Booking earnings</h2>
        <p>
          A transfer sends earnings to your Stripe balance. A bank payout is a separate step; its
          timing and status appear below and in Stripe.
        </p>
        {!data?.earnings.length ? (
          <p>No payment activity yet.</p>
        ) : (
          data.earnings.map((entry) => (
            <article key={entry.booking_id} style={{ marginTop: 24 }}>
              <Link href={`/bookings/${entry.booking_id}`}>View booking</Link>
              <p>
                {entry.booking_status.replaceAll("_", " ")} · Payment{" "}
                {entry.payment?.state ?? "not received"}
              </p>
              {entry.payment ? (
                <p>
                  Guest total {formatMoney(entry.payment.amount_cents)} · Qualia fee{" "}
                  {formatMoney(entry.payment.commission_cents)} ·{" "}
                  {entry.payment.processing_allocation === "platform_absorbs"
                    ? "Qualia covers processing costs"
                    : entry.payment.processor_fee_cents === null
                      ? "Processing cost awaiting confirmation"
                      : `Processing cost ${formatMoney(entry.payment.processor_fee_cents)}`}
                </p>
              ) : null}
              {entry.operations.length ? (
                <ul>
                  {entry.operations.map((op) => (
                    <li key={op.operation_id}>
                      {op.kind === "reversal" ? "Host recovery" : op.kind}{" "}
                      {formatMoney(op.amount_cents)} · {op.state}
                      {op.reversed_total_cents
                        ? ` · recovered ${formatMoney(op.reversed_total_cents)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Earnings have not been released.</p>
              )}
            </article>
          ))
        )}
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Bank payouts</h2>
        {!data?.payouts.length ? (
          <p>No bank payouts recorded.</p>
        ) : (
          <ul>
            {data.payouts.map((p) => (
              <li key={p.payout_id}>
                {(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()} · {p.state}
                {p.arrival_date
                  ? ` · estimated arrival ${new Date(p.arrival_date).toLocaleDateString("en-US", { timeZone: "America/New_York" })}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}
