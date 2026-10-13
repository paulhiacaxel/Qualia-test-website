import type { Metadata } from "next";
import Image from "next/image";
import { eduardoProposal as proposal } from "@/lib/previews/eduardo";
import styles from "./preview.module.css";

export const metadata: Metadata = {
  title: "Portraits with Eduardo Bono — listing preview",
  description:
    "A first look at Eduardo Bono’s photography on Qualia. Prepared for Eduardo to review; this draft is not bookable.",
  robots: { index: false, follow: false, nocache: true },
};

export default function EduardoBonoPreviewPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={`container ${styles.previewNotice}`} role="note">
        <span className={styles.noticeLabel}>Prepared for Eduardo · Listing preview</span>
        <span>This draft is not bookable.</span>
        <a href="#preview-notes">About this first look ↗</a>
      </div>

      <section className={`container ${styles.hero}`} aria-labelledby="experience-title">
        <header className={styles.heroHeading}>
          <div>
            <p className={`eyebrow ${styles.kicker}`}>Photography · Brickell, Miami</p>
            <h1 id="experience-title">
              Portraits with
              <br />a sense of <em>place.</em>
            </h1>
          </div>
          <div className={styles.heroIntro}>
            <span className={styles.hostName}>With Eduardo Bono</span>
            <p>
              A little time in Miami.
              <br />
              Photographs that feel like you.
            </p>
            <a href="#the-session" className={styles.jumpLink}>
              Explore the proposed session <span aria-hidden="true">↓</span>
            </a>
          </div>
        </header>

        <div className={styles.heroGallery}>
          <figure className={styles.heroPhoto}>
            <Image
              {...proposal.photos.hero}
              unoptimized
              priority
              sizes="(max-width: 700px) 100vw, 70vw"
            />
          </figure>
          <figure className={styles.heroPortrait}>
            <Image
              {...proposal.photos.portrait}
              unoptimized
              priority
              sizes="(max-width: 700px) 50vw, 30vw"
            />
            <figcaption>
              <span>People. Light. A point of view.</span>
              <span>Photography by Eduardo Bono</span>
            </figcaption>
          </figure>
        </div>
        <div className={styles.galleryCredit}>
          <span>Selected work from Eduardo’s portfolio</span>
          <a href={proposal.portfolioUrl} target="_blank" rel="noopener noreferrer">
            View his work ↗
          </a>
        </div>

        <dl className={styles.facts} aria-label="Published package reference">
          <div>
            <dt>
              <span>01</span> The setting
            </dt>
            <dd>Brickell, Miami</dd>
          </div>
          <div>
            <dt>
              <span>02</span> The time
            </dt>
            <dd>One hour</dd>
          </div>
          <div>
            <dt>
              <span>03</span> The keepsake
            </dt>
            <dd>40 edited photographs</dd>
          </div>
        </dl>
      </section>

      <div className={`container ${styles.experienceContent}`} id="the-session">
        <div className={styles.story}>
          <section className={styles.introduction}>
            <span className="eyebrow">Your Miami chapter</span>
            <h2>
              Be in the moment.
              <br />
              <em>Keep a little of it.</em>
            </h2>
            <p className={styles.lead}>
              A visit worth remembering. A new chapter. Or simply an excuse to get in front of the
              camera.
            </p>
            <p>
              Eduardo describes his approach as natural and spontaneous, with a street-photography
              aesthetic. This proposed listing brings his existing {proposal.packageName} photo
              session to Qualia: an hour in Miami, with {proposal.editedPhotos} edited photographs
              delivered within {proposal.deliveryHours} hours under his published package.
            </p>
            <p>
              The mood, meeting point and who comes along would be agreed with Eduardo. His final
              Qualia offering is still to be confirmed.
            </p>
          </section>

          <section className={styles.sessionPlan}>
            <span className="eyebrow">A session, shaped around you</span>
            <h2>Make room for your story.</h2>
            <ol>
              <li>
                <span className={styles.stepNumber}>01</span>
                <div>
                  <h3>Start with what you have in mind.</h3>
                  <p>
                    Share the occasion, the feeling you want and who you’d like in the photographs.
                    Eduardo can confirm what fits the session.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.stepNumber}>02</span>
                <div>
                  <h3>Spend an hour in Brickell.</h3>
                  <p>
                    The proposed setting for this listing, based on his existing package. The exact
                    location and plan stay in Eduardo’s hands.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.stepNumber}>03</span>
                <div>
                  <h3>Take a little of Miami with you.</h3>
                  <p>
                    The published package includes {proposal.editedPhotos} edited images within{" "}
                    {proposal.deliveryHours} hours. Final delivery details would be confirmed before
                    booking.
                  </p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        {/* A reference card, not an inventory or payment interface. */}
        <aside className={styles.sessionCard} aria-label="Proposed listing details">
          <span className={`eyebrow ${styles.cardEyebrow}`}>The proposed experience</span>
          <h2>
            Your time
            <br />
            <em>with Eduardo.</em>
          </h2>
          <div className={styles.price}>
            <span>${proposal.minimumDollars}</span>
            <span>minimum session total</span>
          </div>
          <p className={styles.perGuest}>
            ${proposal.pricePerGuestDollars} per guest · ${proposal.minimumDollars} minimum
          </p>
          <dl className={styles.sessionDetails}>
            <div>
              <dt>Duration</dt>
              <dd>1 hour</dd>
            </div>
            <div>
              <dt>Includes</dt>
              <dd>40 edited photos</dd>
            </div>
            <div>
              <dt>Published delivery</dt>
              <dd>Within 48 hours</dd>
            </div>
            <div>
              <dt>Guest capacity</dt>
              <dd>To confirm</dd>
            </div>
            <div>
              <dt>Dates &amp; times</dt>
              <dd>To confirm</dd>
            </div>
          </dl>
          <p className={styles.referenceNote}>
            Reference terms from Eduardo’s published “{proposal.packageName}” service. Final Qualia
            pricing, inclusions and private or group options need his approval.
          </p>
          <div className={styles.unavailable}>Preview — bookings unavailable</div>
          <a href={proposal.editUrl} className={styles.editLink}>
            Eduardo, share your thoughts <span aria-hidden="true">↗</span>
          </a>
          <p className={styles.cardFootnote}>
            Nothing goes live until the details are agreed and the listing is reviewed.
          </p>
        </aside>
      </div>

      <section className={styles.artistSection} aria-labelledby="artist-title">
        <div className={`container ${styles.artistInner}`}>
          <div className={styles.artistTitle}>
            <span className="eyebrow">The person behind the camera</span>
            <h2 id="artist-title">
              Eduardo
              <br />
              <em>Bono.</em>
            </h2>
            <div className={styles.artistIdentity}>
              <Image {...proposal.headshot} unoptimized sizes="72px" />
              <p>
                Photographer
                <br />
                &amp; creative director
              </p>
            </div>
          </div>
          <div className={styles.artistStory}>
            <p className={styles.artistLead}>
              A background in design.
              <br />
              An eye for people.
            </p>
            <p>
              Eduardo’s published profile describes ten years of photography experience and a
              background in graphic design. His portfolio brings together photography and creative
              work.
            </p>
            <p>
              Among his projects is <em>Grads on the Porch</em>, created during the pandemic.
            </p>
            <a href={proposal.portfolioUrl} target="_blank" rel="noopener noreferrer">
              Spend a moment with his portfolio <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <section className={`container ${styles.portfolio}`} aria-labelledby="portfolio-title">
        <header>
          <div>
            <span className="eyebrow">Through his lens</span>
            <h2 id="portfolio-title">
              A few frames. <em>His point of view.</em>
            </h2>
          </div>
          <span className={styles.portfolioLabel}>
            Selected portfolio work
            <br />
            Eduardo Bono
          </span>
        </header>
        <div className={styles.portfolioGrid}>
          {[proposal.photos.light, proposal.photos.moment, proposal.photos.place].map(
            (photo, index) => (
              <figure key={photo.src}>
                <Image {...photo} unoptimized sizes="(max-width: 560px) 100vw, 33vw" />
                <figcaption>
                  <span>0{index + 1}</span>
                  <span>From Eduardo’s portfolio</span>
                </figcaption>
              </figure>
            ),
          )}
        </div>
        <p className={styles.portfolioNote}>
          These photographs show Eduardo’s existing work, not previous Qualia bookings or a
          guaranteed session location.
        </p>
      </section>

      <section className={`container ${styles.nextIdea}`} aria-labelledby="next-idea-title">
        <div>
          <span className="eyebrow">One more possibility to discuss</span>
          <h2 id="next-idea-title">
            For guests who’d love
            <br />
            to get <em>behind</em> the camera.
          </h2>
        </div>
        <div>
          <p>
            Our invitation also suggested a portrait photography lesson. If that appeals to Eduardo,
            we could shape a separate session around how he sees light, directs a portrait and
            chooses a setting.
          </p>
          <p className={styles.ideaNote}>
            That would be a new concept to develop together—not an existing lesson we’re
            advertising. Eduardo would set its format, guest limit, duration and price.
          </p>
          <a href={proposal.editUrl} className={styles.ideaLink}>
            Let’s shape it together <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <div className={`container ${styles.reviewNote}`} id="preview-notes">
        <details>
          <summary>About this preview, references &amp; photo credits</summary>
          <div className={styles.reviewDetails}>
            <p>
              Qualia prepared this unlisted page for Eduardo Bono to review. It is not an approved
              partnership or a published, bookable experience. Anyone with the link can view it. No
              dates, guest capacity or private/shared format have been confirmed.
            </p>
            <p>
              The “{proposal.packageName}” package, ${proposal.pricePerGuestDollars} per-guest rate,
              ${proposal.minimumDollars} minimum, one-hour duration, {proposal.editedPhotos} edited
              photographs and {proposal.deliveryHours}-hour delivery reference were checked on
              Eduardo’s{" "}
              <a href={proposal.serviceUrl} target="_blank" rel="noopener noreferrer">
                published photography service
              </a>{" "}
              on {proposal.checkedAt}. His photographer and creative-director description,
              experience, graphic-design background and <em>Grads on the Porch</em> project are
              described there. These are source references, not confirmed Qualia terms.
            </p>
            <p>
              Photographs are from Eduardo’s{" "}
              <a href={proposal.portfolioUrl} target="_blank" rel="noopener noreferrer">
                public portfolio
              </a>{" "}
              and{" "}
              <a href={proposal.serviceUrl} target="_blank" rel="noopener noreferrer">
                published photography service
              </a>
              , including his profile photo. Photography is credited to Eduardo Bono. These images
              span his existing work and are not all represented as Brickell locations; subjects are
              not identified as Qualia guests. Photo selection, permission to publish, copy, prices,
              inclusions, meeting point, participant rules and cancellation terms all remain for
              Eduardo’s approval and Qualia review.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}
