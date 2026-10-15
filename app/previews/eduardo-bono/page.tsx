import type { Metadata } from "next";
import Image from "next/image";
import { eduardoProposal as proposal } from "@/lib/previews/eduardo";
import styles from "./preview.module.css";

export const metadata: Metadata = {
  title: "Through a photographer’s eyes with Eduardo Bono — listing preview",
  description:
    "Bring your own camera for a Brickell photo walk and conversation with Eduardo Bono. A listing preview, prepared for his review and not yet bookable.",
  robots: { index: false, follow: false, nocache: true },
};

export default function EduardoBonoPreviewPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={`container ${styles.previewNotice}`} role="note">
        <span className={styles.noticeLabel}>Prepared for Eduardo · Listing preview</span>
        <span>Updated with Eduardo’s notes · Not yet bookable</span>
        <a href="#preview-notes">About this preview ↗</a>
      </div>

      <section className={`container ${styles.hero}`} aria-labelledby="experience-title">
        <header className={styles.heroHeading}>
          <div>
            <p className={`eyebrow ${styles.kicker}`}>Photography · Brickell, Miami</p>
            <h1 id="experience-title">
              See through
              <br />a photographer’s <em>eyes.</em>
            </h1>
          </div>
          <div className={styles.heroIntro}>
            <span className={styles.hostName}>With Eduardo Bono</span>
            <p>
              Bring your own camera.
              <br />
              Spend time looking, making photographs and talking about what you see.
            </p>
            <a href="#the-session" className={styles.jumpLink}>
              Explore the session <span aria-hidden="true">↓</span>
            </a>
          </div>
        </header>

        <div className={styles.heroGallery}>
          <figure className={styles.heroPhoto}>
            <Image
              {...proposal.photos.place}
              unoptimized
              preload
              sizes="(max-width: 700px) 100vw, 70vw"
            />
          </figure>
          <figure className={styles.heroPortrait}>
            <Image
              {...proposal.photos.portrait}
              unoptimized
              sizes="(max-width: 700px) 50vw, 30vw"
            />
            <figcaption>
              <span>What catches your eye?</span>
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

        <dl className={styles.facts} aria-label="Proposed experience at a glance">
          <div>
            <dt>
              <span>01</span> The starting idea
            </dt>
            <dd>A photography walk in Brickell</dd>
          </div>
          <div>
            <dt>
              <span>02</span> The time
            </dt>
            <dd>{proposal.durationLabel}</dd>
          </div>
          <div>
            <dt>
              <span>03</span> What to bring
            </dt>
            <dd>Your own camera</dd>
          </div>
        </dl>
      </section>

      <div className={`container ${styles.experienceContent}`} id="the-session">
        <div className={styles.story}>
          <section className={styles.introduction}>
            <span className="eyebrow">A walk. A camera. Your point of view.</span>
            <h2>
              Take your time.
              <br />
              <em>See what you notice.</em>
            </h2>
            <p className={styles.lead}>
              Light between buildings. A reflection in glass. An expression you nearly missed.
            </p>
            <p>
              Join Eduardo with your own camera for a session about seeing as much as photographing.
              Begin with a conversation, head out to take photographs together, then return to look
              through what you made.
            </p>
            <p>
              The conversation afterwards matters, too: what caught your attention, how it felt to
              be there and why you chose that frame. You’ll be making your own photographs, with
              Eduardo there to guide you.
            </p>
          </section>

          <section className={styles.sessionPlan} aria-labelledby="session-plan-title">
            <span className="eyebrow">The session we discussed</span>
            <h2 id="session-plan-title">Time to look, try and reflect.</h2>
            <ol>
              {proposal.itinerary.map((step, index) => (
                <li key={step.title}>
                  <span className={styles.stepNumber}>0{index + 1}</span>
                  <div>
                    <span className={styles.stepTime}>{step.minutes} minutes</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.setting} aria-labelledby="setting-title">
            <span className="eyebrow">Where your eye takes you</span>
            <h2 id="setting-title">See Brickell a little differently.</h2>
            <p>
              Brickell is the starting point for this photography walk. Explore light, architecture
              and city scenes with Eduardo, finding the angles and details that catch your eye.
            </p>
            <p>
              There’s no need to see the city exactly as he does. Bring your own perspective and
              camera; he’ll help you explore both. The exact route, meeting point and available
              times will be confirmed before booking.
            </p>
          </section>
        </div>

        {/* Proposal only: no price basis, capacity, inventory or checkout is assumed. */}
        <aside className={styles.sessionCard} aria-label="Proposed listing details">
          <span className={`eyebrow ${styles.cardEyebrow}`}>The proposed experience</span>
          <h2>
            Your camera.
            <br />
            <em>Eduardo’s guidance.</em>
          </h2>
          <div className={styles.price}>
            <span>${proposal.proposedPriceDollars}</span>
            <span>discussed price</span>
          </div>
          <p className={styles.priceBasis}>Per-session or per-guest pricing to confirm.</p>
          <dl className={styles.sessionDetails}>
            <div>
              <dt>Duration</dt>
              <dd>{proposal.durationLabel}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>Briefing, photo walk &amp; review</dd>
            </div>
            <div>
              <dt>Equipment</dt>
              <dd>Bring your own camera</dd>
            </div>
            <div>
              <dt>Guest limit</dt>
              <dd>To confirm with Eduardo</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>Brickell, Miami</dd>
            </div>
            <div>
              <dt>Dates &amp; meeting point</dt>
              <dd>Exact details to confirm</dd>
            </div>
          </dl>
          <p className={styles.referenceNote}>
            Prepared from our {proposal.discussedAt} conversation. The final location, guest
            options, price basis and meeting details will be agreed before this becomes bookable.
          </p>
          <div className={styles.unavailable}>Preview — bookings unavailable</div>
          <a href={proposal.editUrl} className={styles.editLink}>
            Eduardo, share your thoughts <span aria-hidden="true">↗</span>
          </a>
          <p className={styles.cardFootnote}>
            This is your page to review. We’ll confirm the details together before publishing.
          </p>
        </aside>
      </div>

      <section className={styles.artistSection} aria-labelledby="artist-title">
        <div className={`container ${styles.artistInner}`}>
          <div className={styles.artistTitle}>
            <span className="eyebrow">The person walking beside you</span>
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
              People, places
              <br />
              and the way we see them.
            </p>
            <p>
              Eduardo’s work moves from portraits to quiet moments outdoors. His published profile
              describes ten years of photography experience and a background in graphic design.
            </p>
            <p>
              Among his projects is <em>Grads on the Porch</em>, created during the pandemic. This
              session brings you behind the camera with him, to explore your own way of looking.
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
          {[proposal.photos.light, proposal.photos.hero, proposal.photos.moment].map(
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
          Eduardo’s existing work, shown for inspiration. These are not photographs from this
          proposed session or a promise of its location or subjects.
        </p>
      </section>

      <section className={`container ${styles.preparation}`} aria-labelledby="preparation-title">
        <div>
          <span className="eyebrow">Before you head out</span>
          <h2 id="preparation-title">
            Bring the camera
            <br />
            you want to <em>get to know.</em>
          </h2>
        </div>
        <div>
          <p>
            The plan is to use your own camera. Let Eduardo know what you’ll bring and what you’d
            like help with, so he can confirm the session is a good fit.
          </p>
          <p className={styles.preparationNote}>
            The route, walking conditions and weather plan will be confirmed before booking. Camera
            hire and a delivered collection of edited photographs are not part of this draft.
          </p>
          <a href={proposal.editUrl} className={styles.ideaLink}>
            Help us finish the details <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <div className={`container ${styles.reviewNote}`} id="preview-notes">
        <details>
          <summary>About this preview &amp; photo credits</summary>
          <div className={styles.reviewDetails}>
            <p>
              Qualia updated this unlisted page after the {proposal.discussedAt} conversation with
              Eduardo. He agreed in principle to list; this page is for approval of the specific
              experience. It is not yet a published, bookable listing. Anyone with the link can view
              it.
            </p>
            <p>
              The proposed 15-minute introduction, 45-minute photo walk, 30-minute review and $300
              price reflect the conversation and Eduardo’s follow-up. Each guest works with 15–20
              images. Whether the price covers a session or each guest, the guest limit, dates and
              private or shared format are still to be confirmed. This draft is for Brickell; the
              exact route, meeting point and weather arrangements need confirmation before booking.
            </p>
            <p>
              Eduardo’s professional background was checked against his{" "}
              <a href={proposal.serviceUrl} target="_blank" rel="noopener noreferrer">
                published photography profile
              </a>{" "}
              on {proposal.backgroundCheckedAt}. Photographs are from his{" "}
              <a href={proposal.portfolioUrl} target="_blank" rel="noopener noreferrer">
                public portfolio
              </a>{" "}
              and published service, including his profile photo. Photography is credited to Eduardo
              Bono; the images span his existing work and are not identified as Brickell or previous
              Qualia experiences. Photo selection, copy, final terms and route arrangements remain
              for his confirmation and Qualia’s listing review.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}
