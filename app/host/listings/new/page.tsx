import { redirect } from "next/navigation";
import { HostNav } from "@/components/host/host-nav";
import { ListingForm } from "@/components/host/listing-form";
import { getHostProfile, getHostResources } from "@/lib/host/data";
import { requireAdultAccount } from "@/lib/auth/session";

export const metadata = { title: "Create an experience" };

export default async function NewListingPage() {
  await requireAdultAccount("/host/listings/new");
  const [profile, resources] = await Promise.all([getHostProfile(), getHostResources()]);
  if (!profile) redirect("/host/profile");
  return (
    <main id="main-content" className="container dashboard">
      <div className="host-page-heading">
        <div>
          <span className="eyebrow">Your next experience</span>
          <h1>Start with the idea.</h1>
          <p>
            Offer a private session, a shared activity, or both. Set your guest limit and prices,
            then save your private draft. Next, add your meeting details, photos, availability, and
            participation and safety requirements. You can come back to finish before submitting for
            review.
          </p>
        </div>
      </div>
      <HostNav />
      <section className="panel profile-editor">
        <ListingForm defaultCity={profile.city} resources={resources} />
      </section>
    </main>
  );
}
