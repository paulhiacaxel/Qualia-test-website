import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionForm } from "@/components/host/action-form";
import { saveAccountProfile } from "@/app/host/actions";
import { getProfile, requireUser } from "@/lib/auth/session";

export const metadata = { title: "Edit your account" };

export default async function AccountProfilePage() {
  const user = await requireUser();
  const profile = await getProfile();
  return (
    <DashboardShell title="A little about you." eyebrow="Your account">
      <section className="panel" style={{ maxWidth: 650 }}>
        <h2>Your details</h2>
        <ActionForm action={saveAccountProfile} label="Save account details">
          <div>
            <label htmlFor="account-name" className="field-label">
              Full name
            </label>
            <input
              id="account-name"
              name="fullName"
              className="field-input"
              defaultValue={profile?.full_name ?? ""}
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
            />
          </div>
        </ActionForm>
        <dl className="details" style={{ marginTop: 28 }}>
          <div>
            <dt>Sign-in email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
        <p>
          Your account name is private. Your host profile has a separate name and bio for guests.
        </p>
        {profile?.is_host ? (
          <Link className="text-link" href="/host/profile">
            Edit your host profile
          </Link>
        ) : null}
      </section>
    </DashboardShell>
  );
}
