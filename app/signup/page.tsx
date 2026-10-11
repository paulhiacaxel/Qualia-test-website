import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authIsConfigured } from "@/lib/supabase/config";
import { firstValue } from "@/lib/auth/validation";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Create an account" };
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const role = firstValue(params.role) === "host" ? "host" : "guest";
  if (await getCurrentUser()) redirect(role === "host" ? "/host/start" : "/account/dashboard");
  return (
    <AuthShell
      title="One account, one step in."
      description="Join Qualia as we prepare our first Miami experiences."
    >
      <nav className="auth-tabs" aria-label="Account access">
        <Link href="/login">Sign in</Link>
        <Link href="/signup" aria-current="page">
          Sign up
        </Link>
      </nav>
      <AuthForm mode="signup" initialRole={role} configured={authIsConfigured()} />
      <p className="auth-footnote">
        We&apos;re pre-launch. Creating an account does not make a booking or publish a listing.
      </p>
    </AuthShell>
  );
}
