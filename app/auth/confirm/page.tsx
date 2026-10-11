import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authIsConfigured } from "@/lib/supabase/config";
import { firstValue, safeNext } from "@/lib/auth/validation";

export const metadata = { title: "Confirm your email link" };
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const type = firstValue(params.type);
  const token = firstValue(params.token_hash);
  const valid = Boolean(
    token &&
    token.length >= 10 &&
    token.length <= 512 &&
    type &&
    ["signup", "recovery", "email"].includes(type),
  );
  return (
    <AuthShell
      title={type === "recovery" ? "Choose a fresh start." : "Your next step starts here."}
      eyebrow="Secure email confirmation"
    >
      {valid ? (
        <AuthForm
          mode="confirm"
          tokenHash={token}
          confirmationType={type}
          next={safeNext(firstValue(params.next))}
          configured={authIsConfigured()}
        />
      ) : (
        <div className="auth-card message-card">
          <p>This email link is incomplete or invalid.</p>
          <Link className="btn btn-primary" href="/verify-email">
            Request a new link
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
