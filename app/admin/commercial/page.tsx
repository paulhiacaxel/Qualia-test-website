import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { commercialPolicySchema } from "@/lib/admin/commercial-validation";
import { foundingOfferSummary } from "@/lib/payments/incentives";
import { CommercialForm, IncentiveForm, PauseForm } from "./policy-form";

export const metadata = { title: "Commercial policy" };
export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<{ environment?: string }>;
}) {
  await requireAdmin();
  const environment = (await searchParams).environment === "live" ? "live" : "sandbox";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_commercial_policy", {
    p_environment: environment,
  });
  const result = commercialPolicySchema.safeParse(data);
  if (error || !result.success) throw new Error("Commercial settings could not be loaded.");
  return (
    <DashboardShell title="The terms behind each booking." eyebrow="Owner settings">
      <AdminNav active="commercial" />
      <nav className="dashboard-nav" aria-label="Payment environment">
        <Link
          href="/admin/commercial?environment=sandbox"
          aria-current={environment === "sandbox" ? "page" : undefined}
        >
          Sandbox
        </Link>
        <Link
          href="/admin/commercial?environment=live"
          aria-current={environment === "live" ? "page" : undefined}
        >
          Live
        </Link>
      </nav>
      <section className="panel">
        <span className="status">
          {environment} · {result.data.enabled ? "Policy enabled" : "Payments disabled"}
        </span>
        <h2 style={{ marginTop: 24 }}>Approve commercial terms</h2>
        <p>
          Each save creates a versioned policy. Existing payment quotes keep their terms. Commission
          is shown to hosts in their payout workspace; it is not advertised on the public home page.
        </p>
        <CommercialForm
          key={`${environment}:${result.data.policy?.id ?? "new"}`}
          environment={environment}
          current={result.data}
        />
      </section>
      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <h2>Founding hosts</h2>
          <p>
            {result.data.policy
              ? foundingOfferSummary({
                  freeBookings: result.data.policy.founder_free_bookings,
                  durationMonths: result.data.policy.founder_duration_months,
                  lifetimeFeeBps: result.data.policy.founder_fee_bps,
                })
              : "Save explicit commercial terms before enrolling a founding host."}{" "}
            Activate only after an approved listing is live and the host agrees to the written terms
            and activation time. Use a backdated activation time only when the displayed policy
            matches the original agreement. Later policy changes apply to new enrollments; existing
            hosts keep their agreed offer.
          </p>
          {result.data.policy && (
            <p>
              {result.data.policy.founder_cohort_cap === null
                ? "This legacy policy has no cohort cap. Choose an explicit cap when saving a new policy."
                : `Cohort cap: ${result.data.policy.founder_cohort_cap} hosts in this environment, counting enrollments across all policy versions.`}
            </p>
          )}
          {result.data.policy && (
            <IncentiveForm
              key={result.data.policy.id}
              kind="founder"
              environment={environment}
              policyId={result.data.policy.id}
            />
          )}
        </section>
        <section className="panel">
          <h2>Qualified referrals</h2>
          <p>
            Grant credits after the referred host completes a first paid experience. The database
            enforces the approved grant size and cap.
          </p>
          <IncentiveForm kind="referral" environment={environment} />
        </section>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Pause new checkout</h2>
        <p>
          Use this if commercial terms or payment operations need review. Existing payment attempts
          and refunds still need to finish.
        </p>
        <PauseForm environment={environment} />
      </section>
    </DashboardShell>
  );
}
