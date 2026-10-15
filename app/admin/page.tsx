import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { getReviewQueue, queueStatuses, type QueueStatus } from "@/lib/admin/data";
import { formatMiamiDate } from "@/lib/admin/validation";
import { firstValue } from "@/lib/auth/validation";
import styles from "@/components/admin/admin.module.css";

export const metadata = { title: "Listing review queue" };
const names: Record<QueueStatus, string> = {
  pending: "Needs review",
  submitted: "Submitted",
  in_review: "In review",
  approved: "Ready to publish",
  published: "Live",
  paused: "Paused",
  rejected: "Returned to host",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedStatus = firstValue(params.status);
  const status = queueStatuses.includes(requestedStatus as QueueStatus)
    ? (requestedStatus as QueueStatus)
    : "pending";
  const requestedPage = Number(firstValue(params.page) ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000
      ? requestedPage
      : 1;
  const { listings, total } = await getReviewQueue(status, page);
  return (
    <DashboardShell title="A considered collection." eyebrow="Listing review">
      <AdminNav active="reviews" />
      <p className="muted">
        Review safety, decide whether a consultation is needed, then approve publication. Every
        decision is recorded.
      </p>
      <nav className={styles.toolbar} aria-label="Filter review queue">
        {queueStatuses.map((filter) => (
          <Link
            href={`/admin?status=${filter}`}
            key={filter}
            aria-current={status === filter ? "page" : undefined}
          >
            {names[filter]}
          </Link>
        ))}
      </nav>
      <p className="eyebrow">
        {total} {total === 1 ? "listing" : "listings"} · {names[status]}
      </p>
      <div className={styles.queue}>
        {listings.map((listing) => (
          <article className={`panel ${styles.queueItem}`} key={listing.id}>
            <div>
              <span className="eyebrow">
                {listing.category} · {listing.status.replaceAll("_", " ")}
              </span>
              <h2>{listing.title}</h2>
              <div className={styles.meta}>
                <span>Submitted {formatMiamiDate(listing.submitted_at)} Miami time</span>
                <span>Safety: {listing.safety_status}</span>
                <span>Consultation: {listing.consultation_status.replaceAll("_", " ")}</span>
              </div>
            </div>
            <Link className="btn btn-outline" href={`/admin/listings/${listing.id}`}>
              Review listing
            </Link>
          </article>
        ))}
      </div>
      {!listings.length ? (
        <section className="panel">
          <h2>No listings in this view.</h2>
          <p>New host submissions will appear here when they are ready for review.</p>
        </section>
      ) : null}
      <nav className={styles.pagination} aria-label="Queue pages">
        <span>
          {page > 1 ? (
            <Link href={`/admin?status=${status}&page=${page - 1}`}>← Previous</Link>
          ) : null}
        </span>
        <span>
          {page * 30 < total ? (
            <Link href={`/admin?status=${status}&page=${page + 1}`}>Next →</Link>
          ) : null}
        </span>
      </nav>
    </DashboardShell>
  );
}
