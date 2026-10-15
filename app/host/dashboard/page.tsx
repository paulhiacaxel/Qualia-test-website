import Link from "next/link";
import { redirect } from "next/navigation";
import { getAssistedHostListing } from "@/lib/host/assisted/data";
import { HostNav } from "@/components/host/host-nav";
import { getHostListings, getHostProfile } from "@/lib/host/data";
import { formatMoney } from "@/lib/host/validation";

export const metadata = { title: "Host workspace" };
export default async function HostDashboardPage() {
  const assisted = await getAssistedHostListing();
  if (assisted && !assisted.confirmed_at) redirect("/host/welcome");
  const [listings, profile] = await Promise.all([getHostListings(), getHostProfile()]);
  return (
    <main id="main-content" className="container dashboard">
      <div className="host-page-heading">
        <div>
          <span className="eyebrow">Host workspace</span>
          <h1>Your world, ready to share.</h1>
          <p>
            Create an experience that feels like you. Save it privately, then send it to Qualia for
            review.
          </p>
        </div>
        <div className="button-row">
          <Link className="btn btn-primary" href={profile ? "/host/listings/new" : "/host/profile"}>
            {profile ? "Create experience" : "Set up host profile"}
          </Link>
        </div>
      </div>
      <HostNav current="dashboard" />
      {!profile || !profile.bio.trim() ? (
        <section className="panel host-welcome">
          <div>
            <h2>Let guests get to know you.</h2>
            <p>
              Add your name, background, and a link to your work before submitting your first
              experience.
            </p>
          </div>
          <Link className="btn btn-outline" href="/host/profile">
            Complete host profile
          </Link>
        </section>
      ) : null}
      {listings.length ? (
        <div className="listing-grid">
          {listings.map((listing) => (
            <article className="panel listing-summary" key={listing.id}>
              <span className={`status status-${listing.status}`}>
                {listing.status.replaceAll("_", " ")}
              </span>
              <h2>{listing.title}</h2>
              <div className="listing-meta">
                <span>{listing.category[0].toUpperCase() + listing.category.slice(1)}</span>
                <span>·</span>
                <span>{listing.city}</span>
                <span>·</span>
                <span>{listing.duration_minutes} min</span>
                <span>·</span>
                <span>{formatMoney(listing.price_cents)}</span>
              </div>
              <div className="button-row">
                <Link className="btn btn-primary btn-sm" href={`/host/listings/${listing.id}/edit`}>
                  {["draft", "rejected"].includes(listing.status)
                    ? "Edit experience"
                    : "View status"}
                </Link>
                <Link
                  className="btn btn-outline btn-sm"
                  href={`/host/listings/${listing.id}/preview`}
                >
                  Private preview
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel empty-state">
          <span className="eyebrow">Your first experience</span>
          <h2>What could an afternoon with you look like?</h2>
          <p>
            Start with a title, a few details, and a price. You can add photos and availability
            before submitting anything.
          </p>
          <Link className="btn btn-primary" href={profile ? "/host/listings/new" : "/host/profile"}>
            {profile ? "Create your first draft" : "Start with your profile"}
          </Link>
        </section>
      )}
    </main>
  );
}
