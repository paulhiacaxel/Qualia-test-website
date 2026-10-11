import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { ReviewForm } from "@/components/admin/review-form";
import { getListingReview } from "@/lib/admin/data";
import { formatMiamiDate } from "@/lib/admin/validation";
import styles from "@/components/admin/admin.module.css";

export const metadata = { title: "Review experience" };
export default async function ListingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getListingReview(id);
  if (!detail) notFound();
  const { listing, host, location, photos, availability, review, history } = detail;
  const portfolio = host.portfolio_url?.startsWith("https://") ? host.portfolio_url : null;
  return (
    <DashboardShell title={listing.title} eyebrow="Experience review">
      <AdminNav active="reviews" />
      <Link href="/admin" className={styles.back}>
        ← Back to review queue
      </Link>
      <div className={styles.statusRow}>
        <span>Listing: {listing.status.replaceAll("_", " ")}</span>
        <span>Safety: {listing.safety_status}</span>
        <span>Consultation: {listing.consultation_status.replaceAll("_", " ")}</span>
      </div>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <section className="panel">
            <span className="eyebrow">
              {listing.category} · {listing.city}
            </span>
            <h2 className={styles.sectionTitle}>The experience</h2>
            <p className={styles.bodyText}>{listing.description}</p>
            <p className={styles.subtitle}>
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                listing.price_cents / 100,
              )}{" "}
              · {listing.duration_minutes} minutes · One guest
            </p>
            <p className={styles.subtitle}>Public area: {listing.neighborhood}</p>
            <h3 className={styles.sectionTitle}>Meet {host.display_name}</h3>
            <p className={styles.bodyText}>{host.bio}</p>
            {portfolio ? (
              <a className="text-link" href={portfolio} target="_blank" rel="noopener noreferrer">
                View host’s work ↗
              </a>
            ) : (
              <p>No portfolio link provided.</p>
            )}
          </section>
          <section className="panel">
            <h2>Private meeting details</h2>
            <p className={styles.callout}>
              Visible here for review. These details are not included in public listing pages.
            </p>
            {location ? (
              <>
                <p>
                  {location.address_line1}
                  <br />
                  {location.address_line2 ? (
                    <>
                      {location.address_line2}
                      <br />
                    </>
                  ) : null}
                  {listing.city}, FL {location.postal_code}
                </p>
                <p className={styles.bodyText}>
                  {location.meeting_instructions || "No additional meeting instructions."}
                </p>
              </>
            ) : (
              <p className="form-error">Meeting address is missing.</p>
            )}
          </section>
          <section className="panel">
            <h2>Listing photos</h2>
            {detail.photoError ? (
              <p className="form-error">
                Some photos could not load. Reload before approving them.
              </p>
            ) : null}
            <div className={styles.photoGrid}>
              {photos.map((photo) => (
                <figure key={photo.id}>
                  {photo.signedUrl ? (
                    <img
                      src={photo.signedUrl}
                      alt={photo.alt_text || "Host-submitted experience photo"}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={styles.unavailable}>Photo unavailable</div>
                  )}
                  <figcaption>{photo.alt_text || "No photo description provided"}</figcaption>
                </figure>
              ))}
            </div>
            {!photos.length ? (
              <p className="form-error">No photos have been added.</p>
            ) : (
              <p className="field-hint">
                Private photo links expire after five minutes. Reload this page to refresh them.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Availability</h2>
            <p className="field-hint">All times are shown in Miami’s time zone.</p>
            <ul className={styles.windows}>
              {availability.map((window) => (
                <li key={window.id}>
                  {formatMiamiDate(window.starts_at)} → {formatMiamiDate(window.ends_at)}
                </li>
              ))}
            </ul>
            {!availability.length ? (
              <p className="form-error">No availability has been added.</p>
            ) : null}
          </section>
        </div>
        <aside className={styles.stack}>
          <section className="panel">
            <h2>Review decision</h2>
            <p className={styles.callout}>
              Before launch, Qualia’s owner must define the category review criteria and required
              documentation. Recording these checks does not substitute for those decisions.
            </p>
            {review?.consultation_scheduled_at ? (
              <p className={styles.callout}>
                Consultation: {formatMiamiDate(review.consultation_scheduled_at)} Miami time
              </p>
            ) : null}
            <ReviewForm listing={listing} review={review} />
          </section>
          {review?.host_feedback ? (
            <section className="panel">
              <h2>Latest host feedback</h2>
              <p className={styles.bodyText}>{review.host_feedback}</p>
            </section>
          ) : null}
          <section className="panel">
            <h2>Review history</h2>
            {!history.length ? (
              <p>No review decisions yet.</p>
            ) : (
              <ol className={styles.history}>
                {history.map((event, index) => (
                  <li key={`${event.created_at}-${index}`}>
                    <strong>{event.outcome.replaceAll("_", " ")}</strong>
                    <p className={styles.bodyText}>{event.internal_note}</p>
                    <small>
                      {formatMiamiDate(event.created_at)} Miami time
                      <br />
                      Reviewer {event.reviewer_id}
                    </small>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </DashboardShell>
  );
}
