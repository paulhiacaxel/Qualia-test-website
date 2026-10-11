import Link from "next/link";
import { ListingForm } from "@/components/host/listing-form";
import { LocationForm } from "@/components/host/location-form";
import { PhotoManager } from "@/components/host/photo-manager";
import { AvailabilityManager } from "@/components/host/availability-manager";
import { HostNav } from "@/components/host/host-nav";
import { ActionForm } from "@/components/host/action-form";
import { deleteListing, submitListing } from "@/app/host/actions";
import { canEditListing, getHostProfile, getListingDetails } from "@/lib/host/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your experience" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ listing, location, photos, availability }, profile] = await Promise.all([
    getListingDetails(id),
    getHostProfile(),
  ]);
  const editable = canEditListing(listing);
  const supabase = await createClient();
  const feedbackResult = await supabase.rpc("get_listing_review_feedback", { p_listing_id: id });
  if (feedbackResult.error) throw new Error("Your review feedback could not be loaded.");
  const feedback = feedbackResult.data?.[0]?.host_feedback as string | undefined;
  const checklist = [
    {
      label: "Host profile",
      complete: Boolean(profile?.bio.trim() && profile.display_name.trim()),
      href: "/host/profile",
    },
    {
      label: "Experience details",
      complete: Boolean(
        listing.title.trim() && listing.description.trim() && listing.neighborhood.trim(),
      ),
      href: "#details",
    },
    {
      label: "Private meeting details",
      complete: Boolean(location?.address_line1 && location.postal_code),
      href: "#meeting",
    },
    {
      label: "At least one photo",
      complete: photos.some((photo) => photo.signedUrl),
      href: "#photos",
    },
    {
      label: "Future availability",
      complete: availability.some(
        (window) =>
          Date.parse(window.starts_at) > Date.now() &&
          Date.parse(window.ends_at) - Date.parse(window.starts_at) >=
            listing.duration_minutes * 60_000,
      ),
      href: "#availability",
    },
  ];
  const complete = checklist.every((item) => item.complete);
  return (
    <main id="main-content" className="container dashboard">
      <div className="host-page-heading">
        <div>
          <span className={`status status-${listing.status}`}>
            {listing.status.replaceAll("_", " ")}
          </span>
          <h1>{listing.title}</h1>
          <p>
            {editable
              ? "Build your experience one step at a time. Each section saves separately."
              : listing.status === "paused"
                ? "Your experience is paused. You can preview your saved details and read Qualia’s feedback."
                : "Your experience details are locked for review or publication. You can still keep your future availability current below."}
          </p>
        </div>
        <div className="button-row">
          <Link className="btn btn-outline" href={`/host/listings/${id}/preview`}>
            Private preview
          </Link>
        </div>
      </div>
      <HostNav />
      {feedback ? (
        <section className="panel" style={{ marginBottom: 24 }}>
          <h2>A note from Qualia</h2>
          <p className="preview-prose">{feedback}</p>
        </section>
      ) : null}
      <div className="host-panels">
        <div className="host-main">
          <section id="details" className="panel">
            <h2>01 / The experience</h2>
            <ListingForm listing={listing} disabled={!editable} />
          </section>
          <section id="meeting" className="panel">
            <h2>02 / Where you&apos;ll meet</h2>
            <p>
              Only your broad neighborhood appears on the listing. Your exact meeting details are
              private and will be shared with confirmed guests.
            </p>
            <LocationForm listingId={id} location={location} disabled={!editable} />
          </section>
          <section id="photos" className="panel">
            <h2>03 / A glimpse of your world</h2>
            <PhotoManager listingId={id} photos={photos} editable={editable} />
          </section>
          <section id="availability" className="panel">
            <h2>04 / Your availability</h2>
            <AvailabilityManager
              listingId={id}
              windows={availability}
              editable={editable || listing.status === "published"}
              canAdd={listing.status !== "paused"}
              durationMinutes={listing.duration_minutes}
            />
          </section>
        </div>
        <aside className="panel host-sidebar">
          <span className="eyebrow">Before you submit</span>
          <h2 style={{ marginTop: 12 }}>A little care goes a long way.</h2>
          <ul className="host-checklist">
            {checklist.map((item) => (
              <li key={item.label}>
                <span
                  className={`check-indicator ${item.complete ? "done" : ""}`}
                  aria-label={item.complete ? "Complete" : "Incomplete"}
                >
                  {item.complete ? "✓" : ""}
                </span>
                <Link className="text-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {editable ? (
            <>
              <p>
                Submitting sends this listing to Qualia for a safety review, an optional
                consultation, and a publication decision.
              </p>
              {!complete ? (
                <p className="field-hint">
                  Complete the items above and save each section before submitting.
                </p>
              ) : null}
              <ActionForm action={submitListing} label="Submit for review">
                <input type="hidden" name="listingId" value={id} />
                <label className="checkbox-label">
                  <input type="checkbox" name="reviewConfirmed" required />
                  I&apos;ve reviewed my listing and confirm that it accurately describes what I
                  offer.
                </label>
              </ActionForm>
            </>
          ) : (
            <>
              <p>
                <strong>Safety review:</strong> {listing.safety_status.replaceAll("_", " ")}
              </p>
              <p>
                <strong>Consultation:</strong> {listing.consultation_status.replaceAll("_", " ")}
              </p>
              <p>Your experience only becomes visible to guests after publication.</p>
            </>
          )}
        </aside>
      </div>
      {listing.status === "draft" && !listing.submitted_at ? (
        <details className="delete-panel">
          <summary>Delete this draft</summary>
          <div>
            <p className="muted">
              This permanently removes the draft, its photos, and its availability.
            </p>
            <ActionForm action={deleteListing} label="Permanently delete draft" danger>
              <input type="hidden" name="listingId" value={id} />
              <label className="checkbox-label">
                <input type="checkbox" name="deleteConfirmed" required />I want to permanently
                delete this draft.
              </label>
            </ActionForm>
          </div>
        </details>
      ) : null}
    </main>
  );
}
