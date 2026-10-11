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
            This creates a private draft. Next, you&apos;ll add your meeting details, photos, and
            availability.
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
