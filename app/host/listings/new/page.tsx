import { redirect } from "next/navigation";
import { HostNav } from "@/components/host/host-nav";
import { ListingForm } from "@/components/host/listing-form";
import { getHostProfile } from "@/lib/host/data";

export const metadata = { title: "Create an experience" };

export default async function NewListingPage() {
  const profile = await getHostProfile();
  if (!profile) redirect("/host/profile");
  return (
    <main id="main-content" className="container dashboard">
      <div className="host-page-heading">
        <div>
          <span className="eyebrow">Your next experience</span>
          <h1>Start with the idea.</h1>
          <p>
            Start with the required details below and save your private draft. Next, add your
            meeting details, photos, and availability. You can come back to finish before submitting
            for review.
          </p>
        </div>
      </div>
      <HostNav />
      <section className="panel profile-editor">
        <ListingForm defaultCity={profile.city} />
      </section>
    </main>
  );
}
