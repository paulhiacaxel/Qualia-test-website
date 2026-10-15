import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/supabase/config";
import { diagnosticMessage } from "@/lib/email/diagnostic";
import { DiagnosticForm } from "./diagnostic-form";

export const metadata = { title: "Email delivery test" };
export const dynamic = "force-dynamic";

export default async function EmailDiagnosticPage() {
  const user = await requireAdmin();
  const siteUrl = getSiteUrl();
  const from = process.env.EMAIL_FROM;
  const ready = Boolean(siteUrl && from && process.env.RESEND_API_KEY && user.email);
  const message = siteUrl ? diagnosticMessage(siteUrl) : null;
  return (
    <DashboardShell title="Check email delivery." eyebrow="Owner tools">
      <AdminNav active="email" />
      <div className="dashboard-grid">
        <section className="panel">
          <h2>One test to your verified address</h2>
          <p>
            This sends the message below using this deployment’s booking email sender. It creates no
            bookings and does not enable the booking email worker.
          </p>
          <p>
            <strong>From:</strong> {from || "Not configured"}
            <br />
            <strong>To:</strong> {user.email || "No verified email"}
          </p>
          {message ? (
            <div className="notice">
              <p>
                <strong>Subject:</strong> {message.subject}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{message.text}</p>
            </div>
          ) : null}
          {ready ? (
            <DiagnosticForm recipient={user.email!} />
          ) : (
            <p className="form-error" role="alert">
              The verified recipient, sender, site URL and booking email key must be configured
              before a test can be sent.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Verify arrival separately</h2>
          <p>
            Provider acceptance is the first check. Confirm Resend reports delivery, then check your
            inbox and reply from your Qualia mailbox.
          </p>
          <p>
            Repeating the test on the same UTC day reuses the same provider request. If an outcome
            is uncertain, check Resend before starting a new test on another day.
          </p>
          <p>
            This checks the deployed email key and sender. Booking notifications, scheduled runs and
            reminders need their own workflow verification.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
