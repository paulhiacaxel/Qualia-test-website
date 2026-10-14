import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { firstValue, safeNext } from "@/lib/auth/validation";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Choose a new password" };
export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext(firstValue((await searchParams).next));
  await requireUser("/account/update-password");
  return (
    <AuthShell
      title="Make it yours."
      eyebrow="Choose a new password"
      description="Use a password you don’t use anywhere else. You’ll sign in again after it’s updated."
    >
      <AuthForm mode="password" next={next} />
    </AuthShell>
  );
}
