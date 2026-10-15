import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Email link expired" };
export default function AuthErrorPage() {
  return (
    <AuthShell title="Let's try a fresh link." eyebrow="Email link unavailable">
      <div className="auth-card message-card">
        <p>
          This link may have expired, already been used, or been opened in a different browser.
          Request a new link and open it in the browser where you started.
        </p>
        <div className="form-stack">
          <Link className="btn btn-primary" href="/verify-email">
            Resend confirmation
          </Link>
          <Link className="btn btn-outline" href="/forgot-password">
            Reset password
          </Link>
          <Link className="form-link" href="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
