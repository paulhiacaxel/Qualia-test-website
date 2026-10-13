import Link from "next/link";
import { Aperture } from "@/components/aperture";
import { ExperienceCard } from "@/components/booking/experience-card";
import { listExperiences } from "@/lib/booking/data";
import "@/components/booking/booking.css";

const categories = ["Cooking", "Sailing", "Photography", "Language", "Music", "Art", "Fitness"];
const hostListingHelpUrl = `mailto:axel@bookqualia.com?subject=${encodeURIComponent("Help with my Qualia listing")}&body=${encodeURIComponent("Hi Axel,\n\nI'd like help putting a lesson on Qualia. Here's what I already offer, or a link to my website:\n\n")}`;

export default async function HomePage() {
  const { experiences } = await listExperiences({ limit: 3 });
  return (
    <main id="main-content">
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">A marketplace for one-on-one experiences</span>
            <h1>
              Step into <em>someone else&apos;s</em> world for an afternoon.
            </h1>
            <p>
              Qualia connects you with independent hosts who share the skills, stories, and
              perspectives that make them who they are. One person, one afternoon, something
              personal.
            </p>
            <div className="button-row">
              <Link href="/discover" className="btn btn-primary">
                Explore Qualia
              </Link>
              <Link href="/signup?role=host" className="btn btn-outline">
                Become a host
              </Link>
            </div>
            <div className="hero-note">
              <span className="ring-dot" />
              Launching in Miami &amp; Miami Beach
            </div>
          </div>
          <div className="hero-art">
            <Aperture className="hero-aperture" />
            <div className="hero-gold-ring" />
            <div className="hero-cards">
              <div className="story-card">
                <span className="eyebrow">For the curious</span>
                <h3>
                  A new skill.
                  <br />A different point of view.
                </h3>
                <p>A one-on-one experience shaped around you.</p>
              </div>
              <div className="story-card">
                <span className="eyebrow">For the people who know</span>
                <h3>
                  What comes naturally to you
                  <br />
                  could mean the world to someone.
                </h3>
                <p>Share your craft as a founding host.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="category-strip">
        <div className="container category-list" aria-label="Experience categories">
          {categories.map((category) => (
            <Link
              href={`/discover?category=${category.toLowerCase()}`}
              className="pill"
              key={category}
            >
              {category}
            </Link>
          ))}
        </div>
      </div>
      {experiences.length ? (
        <section className="section container">
          <div className="section-heading">
            <span className="eyebrow">From the Miami collection</span>
            <h2>Meet your next afternoon.</h2>
          </div>
          <div className="experience-grid">
            {experiences.map((experience) => (
              <ExperienceCard key={experience.id} experience={experience} />
            ))}
          </div>
          <Link className="btn btn-outline" href="/discover">
            Explore all experiences
          </Link>
        </section>
      ) : null}
      <section id="how-it-works" className="section container">
        <div className="section-heading">
          <span className="eyebrow">A little less ordinary</span>
          <h2>
            Built around people,
            <br />
            and what they can share.
          </h2>
          <p className="muted">
            We&apos;re preparing our first collection of personal experiences in Miami. Bookings
            will open after hosts and their listings are reviewed.
          </p>
        </div>
        <div className="three-column">
          <article className="step-card">
            <span className="step-number">01 / FIND YOUR PERSON</span>
            <h3>Follow your curiosity.</h3>
            <p>
              Discover a craft, a skill, or a corner of the world through someone who knows it well.
            </p>
          </article>
          <article className="step-card">
            <span className="step-number">02 / MAKE IT PERSONAL</span>
            <h3>Time that&apos;s yours.</h3>
            <p>One guest and one host, with room for questions, conversation, and your own pace.</p>
          </article>
          <article className="step-card">
            <span className="step-number">03 / TAKE IT WITH YOU</span>
            <h3>More than an afternoon.</h3>
            <p>Leave with a new perspective and something you can keep learning.</p>
          </article>
        </div>
      </section>
      <section id="hosts" className="section host-section">
        <div className="container">
          <div>
            <span className="eyebrow">Our first Miami hosts</span>
            <h2>There&apos;s something only you can teach.</h2>
            <p>
              Already teach one-on-one in Miami or Miami Beach? Listing on Qualia is free. You set
              your price and availability. Send us your existing lesson or website, and we&apos;ll
              write your experience page for you to approve.
            </p>
            <p>
              We&apos;re preparing to launch with our first 30 Founding Hosts. Every experience is
              reviewed before it goes live.
            </p>
          </div>
          <div className="button-row host-actions">
            <a href={hostListingHelpUrl} className="btn">
              Let Axel help with your listing
            </a>
            <Link href="/signup?role=host" className="host-signup-link">
              Or create your own host account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
