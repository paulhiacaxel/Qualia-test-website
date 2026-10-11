import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { commercialPolicySchema } from "@/lib/admin/commercial-validation";
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
            Enroll after the host agrees to the written terms. The first ten commission-free
            bookings expire six calendar months after the agreed enrollment time, whichever comes
            first.
          </p>
          <IncentiveForm kind="founder" environment={environment} />
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
