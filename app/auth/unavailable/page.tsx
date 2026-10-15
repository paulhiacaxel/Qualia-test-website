import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Opening soon" };
export default function UnavailablePage() {
  return (
    <AuthShell title="We're getting ready." eyebrow="Qualia is pre-launch">
      <div className="auth-card message-card">
        <p>
          Account access is opening soon. We&apos;re preparing the first Qualia experiences in Miami
          and Miami Beach.
        </p>
        <Link className="btn btn-primary" href="/">
          Back to Qualia
        </Link>
      </div>
    </AuthShell>
  );
}
