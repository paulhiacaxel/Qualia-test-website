import Image from "next/image";
import Link from "next/link";
import { getHostProfile, getListingDetails } from "@/lib/host/data";
import { formatMoney, formatMiamiDate } from "@/lib/host/validation";
import { getListingSafetySubmission } from "@/lib/participation/data";

export const metadata = { title: "Private experience preview" };

export default async function PreviewListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ listing, photos, availability }, host, safety] = await Promise.all([
    getListingDetails(id),
    getHostProfile(),
    getListingSafetySubmission(id),
  ]);
  const futureWindows = availability.filter((window) => Date.parse(window.starts_at) > Date.now());
  return (
    <main id="main-content" className="container listing-preview">
      <div className="panel preview-notice">
        <p>
          <strong>Your private preview.</strong> This page is only visible to you. It does not
          publish your experience or accept bookings.
        </p>
        <Link href={`/host/listings/${id}/edit`} className="btn btn-outline btn-sm">
          Back to experience
        </Link>
      </div>
      <div className="preview-title">
        <span className="eyebrow">
          {listing.category} · {listing.city}
        </span>
        <h1>{listing.title}</h1>
        <div className="preview-subtitle">
          <span>With {host?.display_name}</span>
          <span>{listing.duration_minutes} minutes</span>
          <span>
            Up to {listing.max_guests} {listing.max_guests === 1 ? "guest" : "guests"}
          </span>
          <span>
            {listing.booking_format === "both"
              ? "Private or shared"
              : listing.booking_format === "shared"
                ? "Shared session"
                : "Private session"}
          </span>
          <span>{listing.neighborhood || "Neighborhood to be added"}</span>
        </div>
      </div>
      {photos.length ? (
        <div className="preview-gallery">
          {photos.map((photo) =>
            photo.signedUrl ? (
              <Image
                key={photo.id}
                src={photo.signedUrl}
                alt={photo.alt_text}
                width={1600}
                height={1200}
                unoptimized
              />
            ) : null,
          )}
        </div>
      ) : (
        <div className="panel host-empty">Your experience photos will appear here.</div>
      )}
      <div className="preview-content">
        <div>
          <section>
            <h2>An afternoon, your way.</h2>
            <p className="preview-prose">
              {listing.description || "Add a description to tell guests what you’ll do together."}
            </p>
          </section>
          <section className="preview-host">
            <span className="eyebrow">Meet your host</span>
            <h2>{host?.display_name}</h2>
            <p className="preview-prose">
              {host?.bio || "Add your host bio to introduce yourself."}
            </p>
            {host?.portfolio_url ? (
              <a
                href={host.portfolio_url}
                className="text-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore my work ↗
              </a>
            ) : null}
          </section>
          <section className="preview-host">
            <h2>Where you&apos;ll meet</h2>
            <p className="muted">
              {listing.neighborhood ? `${listing.neighborhood}, ` : ""}
              {listing.city}
            </p>
            <p className="muted">
              Exact meeting details are kept private and shared with confirmed guests.
            </p>
          </section>
          <section className="preview-host">
            <h2>Proposed participation details</h2>
            <p className="field-hint">
              This private preview shows the guest-facing information you have proposed. Qualia must
              approve the current version before publication. Private review evidence is not part of
              the public listing.
            </p>
            {safety ? (
              <>
                <p>
                  Participant ages: {safety.min_age ?? "to be added"}–
                  {safety.max_age ?? "to be added"}.
                </p>
                <p>
                  Guardian presence for minors:{" "}
                  {safety.guardian_presence === "required"
                    ? "required"
                    : safety.guardian_presence === "not_required"
                      ? "not proposed; any minor participation without a guardian requires separate approval"
                      : "to be added"}
                  .
                </p>
                {[
                  ["Who can take part", safety.participation_rules],
                  ["Risks to understand", safety.hazards],
                  ["Equipment and what to bring", safety.equipment],
                  ["Experience and other requirements", safety.prerequisites],
                  ["Supervision and guardian arrangements", safety.supervision_plan],
                ].map(([label, value]) => (
                  <div key={label}>
                    <h3>{label}</h3>
                    <p className="preview-prose">{value || "To be added before review."}</p>
                  </div>
                ))}
              </>
            ) : (
              <p>Add participation and safety details in section 05 of your editor.</p>
            )}
          </section>
        </div>
        <aside className="panel">
          {listing.booking_format !== "shared" ? (
            <div>
              <span className="eyebrow">Private session</span>
              <div className="preview-price">
                {formatMoney(listing.price_cents)}{" "}
                <small>
                  / {listing.private_price_basis === "group" ? "private group" : "guest"}
                </small>
              </div>
              <p className="field-hint">
                {listing.private_price_basis === "group"
                  ? "One total for the whole private party, up to your guest limit."
                  : "Price multiplied by the private party’s guest count; the session is exclusive to that party."}
              </p>
            </div>
          ) : null}
          {listing.booking_format !== "private" && listing.shared_price_cents ? (
            <div>
              <span className="eyebrow">Shared session</span>
              <div className="preview-price">
                {formatMoney(listing.shared_price_cents)} <small>/ guest</small>
              </div>
              <p className="field-hint">
                Separate bookings may join the same session, up to {listing.max_guests} guests in
                total.
              </p>
            </div>
          ) : null}
          <p>
            {listing.duration_minutes} minutes · up to {listing.max_guests}{" "}
            {listing.max_guests === 1 ? "guest" : "guests"}
          </p>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "24px 0" }} />
          <span className="eyebrow">Your saved availability</span>
          {futureWindows.length ? (
            <ul className="availability-list">
              {futureWindows.slice(0, 6).map((window) => (
                <li key={window.id}>
                  <div>
                    <time dateTime={window.starts_at}>{formatMiamiDate(window.starts_at)}</time>
                    <span className="availability-separator">to</span>
                    <time dateTime={window.ends_at}>{formatMiamiDate(window.ends_at)}</time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Add future availability in your editor.</p>
          )}
          <p className="field-hint">
            This preview is private. Guests can request a time once the experience is published and
            bookings open.
          </p>
        </aside>
      </div>
    </main>
  );
}
