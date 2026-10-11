"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AuthShell title="Let's try that again." eyebrow="Something didn’t load">
      <div className="auth-card message-card">
        <p>We couldn&apos;t complete that request right now. Please try again in a moment.</p>
        <div className="form-stack">
          <button className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <Link className="form-link" href="/">
            Back to Qualia
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
