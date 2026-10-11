import Link from "next/link";
import { HostNav } from "@/components/host/host-nav";
import { ProfileForm } from "@/components/host/profile-form";
import { getHostListings, getHostProfile } from "@/lib/host/data";
import { requireHost } from "@/lib/auth/session";

export const metadata = { title: "Your host profile" };

export default async function HostProfilePage() {
  const { profile: account } = await requireHost();
  const [profile, listings] = await Promise.all([getHostProfile(), getHostListings()]);
  const locked = listings.some((listing) => !["draft", "rejected"].includes(listing.status));
  return (
    <main id="main-content" className="container dashboard">
      <div className="host-page-heading">
        <div>
          <span className="eyebrow">The person behind the experience</span>
          <h1>Tell your story.</h1>
          <p>Let guests know what you do, how you learned it, and why you love sharing it.</p>
        </div>
      </div>
      <HostNav current="profile" />
      {locked ? (
        <p className="notice">
          Your profile is part of an experience that is under review, approved, published, or
          paused. Profile editing is locked until those experiences are returned for changes.
        </p>
      ) : null}
      <section className="panel profile-editor">
        <ProfileForm profile={profile} defaultName={account.full_name} disabled={locked} />
      </section>
      <p className="profile-help">
        Your profile stays private until an experience is published. Ready for the next step?{" "}
        <Link className="text-link" href="/host/listings/new">
          Create an experience
        </Link>
        .
      </p>
    </main>
  );
}
