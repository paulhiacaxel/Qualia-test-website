import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { requireUser, getProfile } from "@/lib/auth/session";

export const metadata = { title: "Become a host" };
export default async function HostStartPage() {
  await requireUser("/host/start");
  const profile = await getProfile();
  if (profile?.is_host) redirect("/host/dashboard");
  return (
    <AuthShell
      title="Share your world."
      eyebrow="Become a host"
      description="Start with your own host workspace."
    >
      <AuthForm mode="host" />
      <p className="auth-footnote">
        Opening a workspace is free. It does not publish a listing or approve an experience.
      </p>
    </AuthShell>
  );
}
