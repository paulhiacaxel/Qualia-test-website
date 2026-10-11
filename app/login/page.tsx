import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authIsConfigured } from "@/lib/supabase/config";
import { firstValue, safeNext } from "@/lib/auth/validation";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(firstValue(params.next));
  if (firstValue(params.mode) === "signup")
    redirect(`/signup?role=${firstValue(params.role) === "host" ? "host" : "guest"}`);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell title="One account, one step in.">
      <nav className="auth-tabs" aria-label="Account access">
        <Link href="/login" aria-current="page">
          Sign in
        </Link>
        <Link href="/signup">Sign up</Link>
      </nav>
      {firstValue(params.updated) === "1" ? (
        <p className="notice success">Your password was updated. Sign in with your new password.</p>
      ) : null}
      <AuthForm mode="login" next={next} configured={authIsConfigured()} />
      <p className="auth-footnote">
        Need a confirmation email?{" "}
        <Link href="/verify-email" className="text-link">
          Request a new link
        </Link>
        .
      </p>
    </AuthShell>
  );
}
