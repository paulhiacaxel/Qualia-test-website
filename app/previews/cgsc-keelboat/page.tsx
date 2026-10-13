import type { Metadata } from "next";
import Image from "next/image";
import { cgscProposal, cgscReferencePrice } from "@/lib/previews/cgsc";
import "@/components/booking/booking.css";
import styles from "./preview.module.css";

export const metadata: Metadata = {
  title: "CGSC private sailing — listing preview",
  description: "A proposed three-hour private keelboat coaching experience for CGSC to review.",
  robots: { index: false, follow: false, nocache: true },
};

export default function CgscKeelboatPreviewPage() {
  return (
    <main id="main-content" className={`container experience-page ${styles.page}`}>
      <div className={styles.previewNotice} role="note">
        <span className={styles.noticeLabel}>A first look</span>
        <p>
          Prepared for CGSC review. <strong>This draft is not bookable.</strong>
        </p>
        <a href="#preview-notes">About this preview ↗</a>
      </div>

      <header className={`experience-heading ${styles.heading}`}>
        <span className="eyebrow">Sailing · Coconut Grove, Miami</span>
        <h1>
          Private keelboat coaching
          <br />
          <em>on Biscayne Bay.</em>
        </h1>
        <p className={styles.lede}>
          More time at the helm. More confidence on the water. A private sailing session with room
          to work on what matters to you.
        </p>
        <div className={`experience-facts ${styles.facts}`}>
          <span>Proposed with Coconut Grove Sailing Club</span>
          <span>3 hours</span>
          <span>One adult participant</span>
        </div>
      </header>

      <div className={`experience-gallery gallery-count-3 ${styles.gallery}`}>
        {cgscProposal.photos.map((photo, index) => (
          <figure className={styles.photo} key={photo.src}>
            <Image
              src={photo.src}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              unoptimized
              priority={index === 0}
              sizes={index === 0 ? "(max-width: 560px) 100vw, 66vw" : "33vw"}
            />
            <figcaption>{photo.caption}</figcaption>
          </figure>
        ))}
      </div>
      <p className={styles.photoCredit}>
        A glimpse of CGSC’s sailing program and waterfront. Club photography; proposed experience
        shown below.
      </p>

      <div className={`experience-content ${styles.content}`}>
        <div className="experience-story">
          <section className={styles.introduction}>
            <span className="eyebrow">Your time afloat</span>
            <h2>Build on what you already know.</h2>
            <p>
              You know the basics. Now make space to practice. Three hours of private keelboat
              coaching on Biscayne Bay, shaped around the skills you want to strengthen.
            </p>
            <p>
              Bring your questions. The club will confirm your goals, instructor and lesson plan
              before arranging a session.
            </p>
            <div className={styles.sessionNotes}>
              <div>
                <span className="eyebrow">The format</span>
                <h3>One-on-one coaching</h3>
                <p>A private lesson for one participant.</p>
              </div>
              <div>
                <span className="eyebrow">The setting</span>
                <h3>Biscayne Bay</h3>
                <p>Meet in Coconut Grove and get out on the water.</p>
              </div>
            </div>
          </section>

          <section>
            <span className="eyebrow">The people behind it</span>
            <h2>Meet Coconut Grove Sailing Club.</h2>
            <p>
              CGSC offers adult sailing instruction and private coaching on 23-foot Ensign
              keelboats. The club will confirm the boat for your session.
            </p>
            <div className={styles.coordinator}>
              <Image
                src={cgscProposal.coordinator.photo}
                alt="Ed Benitez, CGSC Keelboat Instructor and Lead Coordinator."
                width={168}
                height={225}
                unoptimized
              />
              <div>
                <span className="eyebrow">A familiar face at the club</span>
                <h3>{cgscProposal.coordinator.name}</h3>
                <p>{cgscProposal.coordinator.role}</p>
              </div>
            </div>
            <p className={styles.smallNote}>
              Your session instructor will be confirmed by the club.
            </p>
            <a
              href={cgscProposal.programUrl}
              className="text-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore the club’s adult sailing program ↗
            </a>
          </section>

          <section>
            <span className="eyebrow">Before you step aboard</span>
            <h2>Who this is for.</h2>
            <ul className={styles.requirements}>
              <li>
                <strong>Some sailing experience.</strong> A Basic Keelboat course, or equivalent
                experience, is required.
              </li>
              <li>
                <strong>One adult participant.</strong> Private coaching, with time for your
                questions and goals.
              </li>
              <li>
                <strong>A coaching session.</strong> Certification exams are separate.
              </li>
            </ul>
            <p className={styles.smallNote}>
              What to bring, participation rules and weather arrangements will be confirmed before
              bookings open.
            </p>
          </section>

          <section>
            <span className="eyebrow">A little corner of Miami</span>
            <h2>Start in Coconut Grove.</h2>
            <div className={styles.location}>
              <div className={styles.locationMark} aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path
                    d="M25 13c0 7-9 15-9 15S7 20 7 13a9 9 0 1 1 18 0Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="16" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <div>
                <h3>Coconut Grove Sailing Club</h3>
                <p>{cgscProposal.address}</p>
              </div>
            </div>
            <p>
              The club will confirm the exact meeting point and arrival instructions when a session
              is arranged.
            </p>
          </section>
        </div>

        {/* This is a visual proposal only: no calendar, booking action or payment route. */}
        <aside
          className={`panel experience-booking ${styles.booking}`}
          aria-label="Proposed session"
        >
          <span className={`eyebrow ${styles.priceEyebrow}`}>Your proposed session</span>
          <div className={`booking-price ${styles.price}`}>
            ${cgscReferencePrice} <small>/ 3-hour session</small>
          </div>
          <p className="booking-price-note">One adult · private keelboat coaching</p>
          <dl className={styles.priceBreakdown}>
            <div>
              <dt>Published coaching rate</dt>
              <dd>${cgscProposal.hourlyRateDollars} / hour</dd>
            </div>
            <div>
              <dt>Minimum session</dt>
              <dd>{cgscProposal.durationHours} hours</dd>
            </div>
            <div>
              <dt>Reference total</dt>
              <dd>${cgscReferencePrice}</dd>
            </div>
          </dl>
          <p className={styles.priceApproval}>
            Based on CGSC’s published private-coaching rate of $80 per hour, per person. Final
            Qualia price and inclusions are subject to club approval.
          </p>
          <div className={styles.availability}>
            <span className="eyebrow">Availability</span>
            <p>Arranged by request</p>
            <small>No dates or times are confirmed for this preview.</small>
          </div>
          <button className={`btn full-width ${styles.unavailable}`} type="button" disabled>
            Draft — bookings unavailable
          </button>
          <a href={cgscProposal.editUrl} className={`text-link ${styles.editLink}`}>
            Suggest an edit →
          </a>
        </aside>
      </div>

      <div className={styles.reviewNote} id="preview-notes">
        <details>
          <summary>About this preview &amp; photo credits</summary>
          <div className={styles.reviewDetails}>
            <p>
              Qualia prepared this unlisted proposal for Coconut Grove Sailing Club to review. It is
              not an approved partnership or a published, bookable experience. Anyone with the link
              can view it.
            </p>
            <p>
              Program details, coordinator information and the $80 hourly rate were checked on
              CGSC’s <a href={cgscProposal.programUrl}>adult sailing page</a> on{" "}
              {cgscProposal.checkedAt}. The $240 reference total is three hours at that published
              per-person rate. Certification is listed separately by the club and is not included in
              this proposal.
            </p>
            <p>
              Photos come from the club’s <a href={cgscProposal.clubUrl}>website</a> and{" "}
              <a href={cgscProposal.programUrl}>adult sailing program</a>. They show existing club
              activity, not past Qualia bookings. Photography, copy, pricing, instructor assignment,
              equipment, participation rules and weather/cancellation arrangements remain for club
              approval and Qualia review before publication.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}
