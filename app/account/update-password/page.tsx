import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Choose a new password" };
export default async function UpdatePasswordPage() {
  await requireUser("/account/update-password");
  return (
    <AuthShell
      title="Make it yours again."
      eyebrow="Choose a new password"
      description="Use a password you don’t use anywhere else. You’ll sign in again after it’s updated."
    >
      <AuthForm mode="password" />
    </AuthShell>
  );
}
