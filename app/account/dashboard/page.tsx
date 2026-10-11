import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser, getProfile } from "@/lib/auth/session";

export const metadata = { title: "Your account" };
export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getProfile();
  return (
    <DashboardShell
      title={profile?.full_name ? `Welcome, ${profile.full_name}.` : "Welcome to Qualia."}
      eyebrow="Your account"
    >
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Your details</h2>
          <dl className="details">
            <div>
              <dt>Name</dt>
              <dd>{profile?.full_name || "Not added yet"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{profile?.is_host ? "Guest and host" : "Guest"}</dd>
            </div>
          </dl>
          <span className="status">Email confirmed</span>
        </section>
        <section className="panel">
          <span className="eyebrow">A little curiosity goes a long way</span>
          <h2>Your next experience starts here.</h2>
          <p>
            We&apos;re putting together our first collection of Miami experiences. Booking will open
            when the collection is ready.
          </p>
          <div className="button-row">
            <Link className="btn btn-primary" href="/discover">
              Explore Qualia
            </Link>
            <Link
              className="btn btn-outline"
              href={profile?.is_host ? "/host/dashboard" : "/host/start"}
            >
              {profile?.is_host ? "Host workspace" : "Become a host"}
            </Link>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
