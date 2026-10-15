import type { Metadata } from "next";
import Image from "next/image";
import { mlkProposal as proposal } from "@/lib/previews/mlk";
import styles from "./preview.module.css";

export const metadata: Metadata = {
  title: "Make your mark with Kyle Holbrook — listing preview",
  description:
    "A proposed mural experience with Kyle Holbrook and Moving Lives of Kids. Prepared for Kyle to review; this unlisted draft is not bookable.",
  robots: { index: false, follow: false, nocache: true },
};

export default function MlkMuralPreviewPage() {
  return (
    <main id="main-content" className={styles.page}>
      <div className={`container ${styles.previewNotice}`} role="note">
        <span className={styles.noticeLabel}>A first look for Kyle &amp; MLK Mural</span>
        <span>Unlisted preview · Not bookable</span>
        <a href="#preview-notes">About this proposal ↗</a>
      </div>

      <section className={`container ${styles.hero}`} aria-labelledby="experience-title">
        <header className={styles.heroHeading}>
          <div>
            <p className={`eyebrow ${styles.kicker}`}>Art, up close · Miami</p>
            <h1 id="experience-title">
              A city full of stories.
              <br />
              <em>Make your mark.</em>
            </h1>
          </div>
          <div className={styles.heroIntro}>
            <span className={styles.hostName}>With Kyle Holbrook · MLK Mural</span>
            <p>
              Step closer to the wall. <br />
              Meet the artist. <br />
              Pick up a brush.
            </p>
            <a href="#the-session" className={styles.jumpLink}>
              See the proposed experience <span aria-hidden="true">↓</span>
            </a>
          </div>
        </header>

        <div className={styles.heroGallery}>
          <figure className={styles.heroPhoto}>
            <Image
              {...proposal.photos.hero}
              unoptimized
              priority
              sizes="(max-width: 650px) 100vw, 70vw"
            />
            <figcaption>
              <span>Art belongs out here.</span>
              <span>Rayos Del Sol · Little Havana, 2013</span>
            </figcaption>
          </figure>
          <div className={styles.heroSide}>
            <div className={styles.colorNote}>
              <span className={styles.swatches} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <p>
                A little color.
                <br />
                <em>A different perspective.</em>
              </p>
              <span>Miami, through an artist’s eyes</span>
            </div>
            <figure className={styles.processPhoto}>
              <Image
                {...proposal.photos.process}
                unoptimized
                priority
                sizes="(max-width: 650px) 50vw, 30vw"
              />
              <figcaption>Kyle at work · Photo by Kirsten Creative</figcaption>
            </figure>
          </div>
        </div>
        <div className={styles.galleryCredit}>
          <span>Real work from MLK Mural’s website · Proposed session below</span>
          <a href={proposal.websiteUrl} target="_blank" rel="noopener noreferrer">
            Explore MLK Mural ↗
          </a>
        </div>
        <dl className={styles.facts} aria-label="Proposed experience at a glance">
          <div>
            <dt>
              <span>01</span> The idea
            </dt>
            <dd>Paint with an artist</dd>
          </div>
          <div>
            <dt>
              <span>02</span> The setting
            </dt>
            <dd>Wynwood, proposed</dd>
          </div>
          <div>
            <dt>
              <span>03</span> The connection
            </dt>
            <dd>Art &amp; community</dd>
          </div>
        </dl>
      </section>

      <div className={`container ${styles.experienceContent}`} id="the-session">
        <div className={styles.story}>
          <section className={styles.introduction}>
            <span className="eyebrow">An invitation to get involved</span>
            <h2>
              Don’t just pass by.
              <br />
              <em>Spend time with the story.</em>
            </h2>
            <p className={styles.lead}>
              What changes when you look at a mural with the person who paints them?
            </p>
            <p>
              This first idea pairs a conversation with Kyle and time at the wall: notice the
              choices behind the colors, learn how a large painting begins, then try a little of the
              process yourself.
            </p>
            <p>
              We’ve shaped it around MLK Mural’s published “Paint a Wynwood Mural” experience. For
              Qualia, we’re proposing a personal lesson with Kyle, with the final project and format
              entirely his to shape.
            </p>
          </section>

          <section className={styles.sessionPlan} aria-labelledby="session-plan-title">
            <span className="eyebrow">A suggested flow · For Kyle’s review</span>
            <h2 id="session-plan-title">From looking to making.</h2>
            <ol>
              <li>
                <span className={styles.stepNumber}>01</span>
                <div>
                  <h3>Meet the person behind the paint.</h3>
                  <p>
                    Begin with the place, the idea and a conversation about public art. Bring your
                    curiosity; Kyle would set the direction.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.stepNumber}>02</span>
                <div>
                  <h3>Get a feel for the tools.</h3>
                  <p>
                    Explore brushes, rollers and the first layers of a mural. The project would
                    determine which techniques make sense to try.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.stepNumber}>03</span>
                <div>
                  <h3>Add your part.</h3>
                  <p>
                    Make a guided contribution to an approved painting surface, then step back and
                    see the piece a little differently. The wall or project is still to be agreed.
                  </p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        {/* This card describes a proposal; it deliberately has no booking or payment controls. */}
        <aside className={styles.sessionCard} aria-label="Proposed listing details">
          <span className={`eyebrow ${styles.cardEyebrow}`}>The experience, at a glance</span>
          <h2>
            A mural lesson.
            <br />
            <em>A Miami connection.</em>
          </h2>
          <div className={styles.price}>Set with Kyle</div>
          <p className={styles.priceNote}>The price is his to choose.</p>
          <dl className={styles.sessionDetails}>
            <div>
              <dt>Proposed host</dt>
              <dd>Kyle Holbrook</dd>
            </div>
            <div>
              <dt>Proposed format</dt>
              <dd>Private lesson</dd>
            </div>
            <div>
              <dt>Time reference</dt>
              <dd>60–90 minutes</dd>
            </div>
            <div>
              <dt>Proposed area</dt>
              <dd>Wynwood, Miami</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>To be agreed</dd>
            </div>
          </dl>
          <p className={styles.referenceNote}>
            The time reference comes from MLK Mural’s published experience. Duration, meeting point,
            materials, guest ages and pricing need Kyle’s confirmation.
          </p>
          <div className={styles.unavailable}>Preview only · Booking isn’t open</div>
          <a className={styles.editLink} href={proposal.feedbackUrl}>
            Kyle, help us shape this <span aria-hidden="true">↗</span>
          </a>
          <p className={styles.cardFootnote}>We prepare the page. You decide what belongs on it.</p>
        </aside>
      </div>

      <section className={styles.mission} aria-labelledby="mission-title">
        <div className={`container ${styles.missionInner}`}>
          <div className={styles.missionHeading}>
            <span className="eyebrow">Moving Lives of Kids</span>
            <h2 id="mission-title">
              More than
              <br />
              <em>a wall.</em>
            </h2>
            <div className={styles.missionRule} aria-hidden="true" />
            <p>Art. Education. Community.</p>
          </div>
          <div className={styles.artistStory}>
            <div className={styles.artistIdentity}>
              <Image {...proposal.photos.artist} unoptimized sizes="84px" />
              <div>
                <h3>Kyle Holbrook</h3>
                <p>Executive Artist · MLK Mural</p>
              </div>
            </div>
            <p className={styles.artistLead}>
              A painting can change a place.
              <br />
              Making it can bring people together.
            </p>
            <p>
              MLK stands for Moving Lives of Kids. Its work connects public art with education and
              community participation. Kyle’s practice is the starting point for this proposal: the
              person, the process, and the people a mural speaks to.
            </p>
            <p>
              We’d like this page to make room for that story, as well as the experience itself.
            </p>
            <a href={proposal.websiteUrl} target="_blank" rel="noopener noreferrer">
              Meet Moving Lives of Kids <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <section className={`container ${styles.portfolio}`} aria-labelledby="portfolio-title">
        <header>
          <div>
            <span className="eyebrow">Out in the world</span>
            <h2 id="portfolio-title">
              Color with
              <br />
              <em>something to say.</em>
            </h2>
          </div>
          <p>
            A closer look at the people and projects <br />
            that inspired this first idea.
          </p>
        </header>
        <div className={styles.portfolioGrid}>
          <figure className={styles.portfolioWide}>
            <Image {...proposal.photos.miami} unoptimized sizes="(max-width: 650px) 100vw, 65vw" />
            <figcaption>
              <span>01</span>
              <span>Americares group · MLK Mural, May 2024</span>
            </figcaption>
          </figure>
          <figure className={styles.portfolioDetail}>
            <Image {...proposal.photos.detail} unoptimized sizes="(max-width: 650px) 70vw, 35vw" />
            <figcaption>
              <span>02</span>
              <span>Los Suenos mural · A past group experience</span>
            </figcaption>
          </figure>
        </div>
        <p className={styles.portfolioNote}>
          Portfolio images show existing work, not a confirmed session location or previous Qualia
          bookings.
        </p>
      </section>

      <section className={`container ${styles.nextIdea}`} aria-labelledby="shape-title">
        <div>
          <span className="eyebrow">Start with one good experience</span>
          <h2 id="shape-title">
            Your work.
            <br />
            <em>Your way of sharing it.</em>
          </h2>
        </div>
        <div>
          <p>
            This is a starting point for a conversation. If a private group, a different project, or
            another part of Miami is a better fit, we can build the page around that.
          </p>
          <p className={styles.ideaNote}>
            Before anything goes live, Kyle would approve the description, image use, price, guest
            limit and available dates, followed by Qualia’s listing review.
          </p>
          <a className={styles.ideaLink} href={proposal.feedbackUrl}>
            Share a thought or a change <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <div className={`container ${styles.reviewNote}`} id="preview-notes">
        <details>
          <summary>About this unlisted preview &amp; image credits</summary>
          <div className={styles.reviewDetails}>
            <p>
              Prepared by Qualia for Kyle Holbrook and Moving Lives of Kids to review. This page is
              accessible by its link, excluded from search indexing, and not included in Qualia’s
              experience catalogue. It is not an approved or bookable listing.
            </p>
            <p>
              The proposed flow takes inspiration from{" "}
              <a href={proposal.experienceUrl} target="_blank" rel="noopener noreferrer">
                MLK Mural’s published experiences
              </a>
              . Artwork and group photographs are from MLK Mural Project’s website. Kyle’s portrait
              and the photograph of him painting are credited to Kirsten Creative on{" "}
              <a
                href="https://www.mlkmural.com/kyle-holbrook"
                target="_blank"
                rel="noopener noreferrer"
              >
                his artist page
              </a>
              . Image permissions and final selection need confirmation before a bookable listing is
              published.
            </p>
            <p>
              No availability, admission requirements or contribution to a charitable program has
              been agreed. Kyle and MLK Mural can request any edits or removal at{" "}
              <a href="mailto:contact@bookqualia.com">contact@bookqualia.com</a>.
            </p>
          </div>
        </details>
        <p className={styles.closingNote}>
          A first look for Kyle &amp; MLK Mural · Unlisted and not bookable
        </p>
      </div>
    </main>
  );
}
