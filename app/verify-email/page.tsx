import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authIsConfigured } from "@/lib/supabase/config";
import { firstValue, safeNext } from "@/lib/auth/validation";

export const metadata = { title: "Check your email" };
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      title="A small step, then you're in."
      eyebrow="Check your inbox"
      description="If your email is eligible for a new account, a confirmation link is on its way. Check your spam folder too."
    >
      <AuthForm
        mode="resend"
        next={safeNext(firstValue(params.next))}
        configured={authIsConfigured()}
      />
      <p className="auth-footnote">
        Already confirmed?{" "}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
        .
      </p>
    </AuthShell>
  );
}
