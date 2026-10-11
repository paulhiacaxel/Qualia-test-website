import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Administration" };
export default async function AdminPage() {
  await requireAdmin();
  return (
    <DashboardShell title="A considered collection." eyebrow="Qualia administration">
      <section className="panel">
        <h2>Review workspace</h2>
        <p>
          The listing review queue will be available after host submissions open. Reviews will track
          safety checks, optional consultations, and publication decisions.
        </p>
      </section>
    </DashboardShell>
  );
}
