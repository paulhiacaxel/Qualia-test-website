import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function NotFound() {
  return (
    <AuthShell title="A little off the path." eyebrow="Page not found">
      <div className="auth-card message-card">
        <p>We couldn&apos;t find that page.</p>
        <Link className="btn btn-primary" href="/">
          Back to Qualia
        </Link>
      </div>
    </AuthShell>
  );
}
