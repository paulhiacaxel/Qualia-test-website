import { DashboardShell } from "@/components/dashboard-shell";
import { requireHost } from "@/lib/auth/session";

export const metadata = { title: "Host workspace" };
export default async function HostDashboardPage() {
  await requireHost();
  return (
    <DashboardShell title="Your world, ready to share." eyebrow="Host workspace">
      <section className="panel">
        <span className="status">Host account active</span>
        <h2 style={{ marginTop: 22 }}>This is where your experiences will begin.</h2>
        <p>
          We&apos;re preparing listing submissions for our first Miami hosts. You&apos;ll be able to
          add your profile, photos, availability, and the experience you want to share.
        </p>
        <p>Every submitted experience will follow this review process before publication:</p>
        <ol className="review-steps">
          <li>1. Safety review</li>
          <li>2. Optional consultation</li>
          <li>3. Approval &amp; publication</li>
        </ol>
      </section>
    </DashboardShell>
  );
}
