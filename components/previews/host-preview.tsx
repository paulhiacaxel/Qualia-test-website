import Image from "next/image";
import Link from "next/link";
import type { HostProposal } from "@/lib/previews/host-proposals";
import styles from "./host-preview.module.css";

export function HostPreview({ proposal: p }: { proposal: HostProposal }) {
  const feedbackUrl = `mailto:axel@bookqualia.com?subject=${encodeURIComponent(`${p.brand} — my Qualia page`)}&body=${encodeURIComponent(`Hi Axel,\n\nI've looked over the ${p.brand} preview. Here are my thoughts:\n\n`)}`;
  const nextStepUrl = `mailto:axel@bookqualia.com?subject=${encodeURIComponent(`${p.brand} — let's finish the page`)}&body=${encodeURIComponent(`Hi Axel,\n\nThe direction of the preview works for me. Let's confirm the remaining details before anything goes live.\n\n`)}`;
  return (
    <main id="main-content" className={styles.page} data-tone={p.tone}>
      <div className={styles.notice} role="note">
        <span className={styles.noticeLabel}>
          A first look for {p.hostFirstName} · {p.brand}
        </span>
        <span>Unlisted draft · Not bookable</span>
        <a href="#for-the-host">Review your page ↓</a>
      </div>

      <section className={styles.hero} aria-labelledby="experience-title">
        <div className={styles.heroHeading}>
          <header>
            <p className={styles.eyebrow}>{p.eyebrow}</p>
            <h1 className={styles.title} id="experience-title">
              {p.title}
              <br />
              <em>{p.titleEmphasis}</em>
            </h1>
          </header>
          <div className={styles.heroIntro}>
            <p className={styles.hostLine}>
              With {p.hostName} · {p.brand}
            </p>
            <p>{p.heroIntro}</p>
            <a href="#the-experience" className={styles.textLink}>
              Explore the proposed experience ↓
            </a>
          </div>
        </div>
        {p.photos ? (
          <>
            <div className={styles.heroGallery}>
              <figure className={styles.heroPhoto}>
                <Image
                  src={p.photos.hero.src}
                  alt={p.photos.hero.alt}
                  width={p.photos.hero.width}
                  height={p.photos.hero.height}
                  unoptimized
                  preload
                  sizes="(max-width: 700px) 100vw, 65vw"
                />
                <figcaption className={styles.imageCaption}>{p.photos.hero.caption}</figcaption>
              </figure>
              <figure className={styles.detailPhoto}>
                <Image
                  src={p.photos.detail.src}
                  alt={p.photos.detail.alt}
                  width={p.photos.detail.width}
                  height={p.photos.detail.height}
                  unoptimized
                  sizes="(max-width: 700px) 100vw, 35vw"
                />
                <figcaption className={styles.imageCaption}>{p.photos.detail.caption}</figcaption>
              </figure>
            </div>
            <div className={styles.galleryCredit}>
              <span>Real images from {p.brand}’s website · Image use pending host approval</span>
              <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer">
                Visit {p.brand} ↗
              </a>
            </div>
          </>
        ) : (
          <div className={styles.photoPlaceholder}>
            <div className={styles.placeholderCopy}>
              <span className={styles.placeholderKicker}>Mica’s Shack · A private sushi class</span>
              <p>
                Good food.
                <br />
                <em>Made together.</em>
              </p>
              <span>Rice. Maki. Nigiri. Then a meal to share.</span>
            </div>
            <div className={styles.placeholderSide}>
              <svg viewBox="0 0 220 180" fill="none" aria-hidden="true">
                <path d="M35 90h150c-7 49-31 69-75 69S42 139 35 90Z" />
                <path d="M32 90c0-11 35-20 78-20s78 9 78 20M78 166h64M108 69l66-54M119 72l76-47" />
              </svg>
              <p>Your class photos will go here</p>
              <span>We’ll add the images you choose and approve.</span>
            </div>
          </div>
        )}
        <dl className={styles.facts} aria-label="Proposed experience at a glance">
          {p.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className={styles.content} id="the-experience">
        <div className={styles.story}>
          <section className={styles.intro}>
            <p className={styles.eyebrow}>{p.storyEyebrow}</p>
            <h2>{p.storyTitle}</h2>
            <p className={styles.lead}>{p.storyLead}</p>
            <p>{p.storyBody}</p>
          </section>
          <section aria-labelledby="session-flow">
            <p className={styles.eyebrow}>A suggested flow · Yours to shape</p>
            <h2 id="session-flow">{p.flowTitle}</h2>
            <ol className={styles.steps}>
              {p.steps.map((step, i) => (
                <li key={step.title}>
                  <span className={styles.stepNumber}>0{i + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className={styles.sessionCard} aria-label="Draft experience details">
          <p className={styles.cardLabel}>The details, so far</p>
          <h2>{p.cardTitle}</h2>
          <dl className={styles.detailList}>
            {p.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.pendingNote}>{p.detailNote}</p>
          <p className={styles.cardLabel}>Preview only · No dates or bookings available</p>
          <a className={styles.reviewButton} href="#for-the-host">
            {p.hostFirstName}, review your page ↓
          </a>
        </aside>
      </div>

      <section
        className={styles.hostSection}
        data-has-photo={Boolean(p.photos)}
        aria-labelledby="host-title"
      >
        {p.photos ? (
          <figure className={styles.hostPhoto}>
            <Image
              src={p.photos.host.src}
              alt={p.photos.host.alt}
              width={p.photos.host.width}
              height={p.photos.host.height}
              unoptimized
              sizes="(max-width: 700px) 100vw, 40vw"
            />
            <figcaption className={styles.imageCaption}>{p.photos.host.caption}</figcaption>
          </figure>
        ) : null}
        <div className={styles.hostCopy}>
          <p className={styles.eyebrow}>{p.hostEyebrow}</p>
          <h2 id="host-title">{p.hostTitle}</h2>
          {p.hostParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className={styles.hostSignature}>
            {p.hostName}
            <span>{p.brand} · Miami</span>
          </p>
          <a
            href={p.aboutUrl}
            className={styles.textLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            More about {p.brand} ↗
          </a>
        </div>
      </section>

      <section className={styles.hostReview} id="for-the-host" aria-labelledby="review-title">
        <div className={styles.reviewHeading}>
          <p className={styles.eyebrow}>For {p.hostFirstName} · Make this yours</p>
          <h2 id="review-title">
            We’ve started the page.
            <br />
            <em>You have the final say.</em>
          </h2>
          <p>{p.reviewIntro}</p>
        </div>
        <div className={styles.reviewActions}>
          <a className={styles.reviewButton} href={nextStepUrl}>
            Looks good? Let’s finish it ↗
          </a>
          <a className={styles.textLink} href={feedbackUrl}>
            Send edits or ask a question ↗
          </a>
          <p className={styles.reviewHelp}>
            Reply directly to Axel at <a href="mailto:axel@bookqualia.com">axel@bookqualia.com</a>.
            No account needed to review this page.
          </p>
        </div>
      </section>
      <div className={styles.processStrip} aria-label="How we get your page ready">
        <div className={styles.processItem}>
          <span>01 · Make it yours</span>
          <h3>Tell us what to change.</h3>
          <p>
            We’ll update the words and photos with you. You don’t need to build the page yourself.
          </p>
        </div>
        <div className={styles.processItem}>
          <span>02 · Set the details</span>
          <h3>Your offer. Your choices.</h3>
          <p>{p.confirmationDetails}</p>
        </div>
        <div className={styles.processItem}>
          <span>03 · Review, then publish</span>
          <h3>Go live when it’s ready.</h3>
          <p>
            We’ll help with account setup, host terms, Stripe onboarding and Qualia’s listing review
            before bookings open.
          </p>
        </div>
      </div>

      <section className={styles.terms} aria-labelledby="hosting-title">
        <div className={styles.termsIntro}>
          <p className={styles.eyebrow}>Hosting with Qualia</p>
          <h2 id="hosting-title">The practical part.</h2>
          <p>Free to list. You choose your offer and price. Here’s how the current terms work.</p>
        </div>
        <div className={styles.termGrid}>
          <div className={styles.termItem}>
            <h3>What does it cost?</h3>
            <p>
              The standard Qualia commission is 17.5%, plus actual payment-processing costs deducted
              from host proceeds.
            </p>
            <p>
              The first 30 verified hosts individually enrolled after an approved listing is
              published can receive the founding offer: 0% Qualia commission on the first 3 eligible
              paid bookings or the first 3 calendar months after agreed activation, whichever comes
              first; then 12.5%. Processing costs still apply. Enrollment requires separate
              acceptance.
            </p>
          </div>
          <div className={styles.termItem}>
            <h3>How do payments work?</h3>
            <p>
              Hosts complete Stripe’s onboarding directly with Stripe. Qualia initiates release of
              eligible earnings after the experience ends, at least 48 hours have passed and an
              administrator confirms completion. Verification, refunds or disputes may delay
              release; bank arrival times vary.
            </p>
          </div>
          <div className={styles.termItem}>
            <h3>What if someone cancels?</h3>
            <p>
              Guests receive a full refund if they cancel at least 48 hours before the start, or if
              the host cancels. Later guest cancellations are reviewed and do not receive an
              automatic refund. Weather and safety issues are reviewed with Qualia. Actual
              processing costs may be nonrecoverable.
            </p>
          </div>
          <div className={styles.termItem}>
            <h3>How will the experience be promoted?</h3>
            <p>
              We’re assembling our first Miami collection. Once it’s ready, promotion is planned
              through Qualia’s website, Instagram and direct outreach. Founding benefits include
              listing-copy help, one approved launch-content feature and rotating category
              prominence at launch. Traffic and bookings are not guaranteed.
            </p>
          </div>
        </div>
        <nav className={styles.termsLinks} aria-label="Full hosting policies">
          <Link href="/host-terms">Read the host terms ↗</Link>
          <Link href="/cancellation-policy">Cancellation policy ↗</Link>
          <Link href="/privacy">Privacy notice ↗</Link>
        </nav>
        <p className={styles.reviewHelp}>
          Approving the wording of this preview does not accept host terms, enroll you in the
          founding offer, or make the experience bookable. Hosts must be 18 or older; activity,
          venue, qualifications and safety details are reviewed before publication.
        </p>
      </section>

      <div className={styles.sourceNote}>
        <details>
          <summary>About this draft &amp; image sources</summary>
          <p>
            Prepared by Qualia for {p.hostName} and {p.brand} to review. This page is available to
            anyone with its link, excluded from search indexing, and absent from the experience
            catalogue. It is not an approved partnership or a bookable listing.
          </p>
          <p>{p.sourceNote}</p>
          <p>
            {p.photos ? (
              <>
                Images are from {p.brand}’s website and show existing work or past activities, not
                Qualia bookings. Selection and permission to use them still need the host’s
                approval. No license or endorsement is claimed.{" "}
              </>
            ) : (
              <>
                This first draft uses a decorative line drawing, not a photograph of Mica’s work.
                Class photographs will be added after Mica selects and approves them.{" "}
              </>
            )}
            <a href={feedbackUrl}>Request changes or removal</a>.
          </p>
          <p>
            Sources:{" "}
            {p.sources.map((source, i) => (
              <span key={source.href}>
                {i > 0 ? " · " : ""}
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.label}
                </a>
              </span>
            ))}
          </p>
        </details>
      </div>
      <p className={styles.footerNote}>
        Prepared with care for {p.brand} · Unlisted draft · Not bookable
      </p>
    </main>
  );
}
