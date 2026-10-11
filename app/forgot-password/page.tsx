import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authIsConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Reset your password" };
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Let's get you back in."
      eyebrow="Reset your password"
      description="Enter your account email and we’ll send you a reset link."
    >
      <AuthForm mode="reset" configured={authIsConfigured()} />
      <p className="auth-footnote">
        <Link className="text-link" href="/login">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
