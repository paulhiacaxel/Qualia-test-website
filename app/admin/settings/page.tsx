import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { bookingPolicySchema } from "@/lib/admin/settings-validation";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Booking settings" };
export default async function BookingSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_policy");
  const parsed = bookingPolicySchema.safeParse(data);
  if (error || !parsed.success) throw new Error("Booking settings could not be loaded.");
  return (
    <DashboardShell title="Set the pace of a booking." eyebrow="Owner settings">
      <AdminNav active="settings" />
      <div className="dashboard-grid">
        <section className="panel">
          <span className="status">
            {parsed.data.enabled ? "New requests enabled" : "New requests disabled"}
          </span>
          <h2 style={{ marginTop: 24 }}>Choose your deadlines</h2>
          <p>
            No deadlines are selected automatically. Decide how much response and payment time works
            for Qualia and its hosts before opening new requests.
          </p>
          <SettingsForm policy={parsed.data} />
        </section>
        <section className="panel">
          <h2>What these settings control</h2>
          <p>
            The host response deadline limits how long an unanswered booking request stays open. The
            payment deadline starts when a host accepts.
          </p>
          <p>
            These settings apply to new booking requests. Changing them does not rewrite deadlines
            already agreed on existing bookings.
          </p>
          <p>
            Platform commission, payment processing, refund rules, and cancellation terms are
            separate launch decisions.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
