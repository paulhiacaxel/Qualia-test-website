import Image from "next/image";
import Link from "next/link";
import { SlotCalendar } from "@/components/booking/slot-calendar";
import { getPublicExperience, getSlots } from "@/lib/booking/data";
import { getCurrentUser } from "@/lib/auth/session";
import { firstValue } from "@/lib/auth/validation";
import { getAccountEligibility, getListingParticipationRules } from "@/lib/participation/data";
import { ParticipationRulesSummary } from "@/components/booking/participation-rules";

export const metadata = { title: "A Qualia experience" };

export default async function ExperiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { listing, host, photos } = await getPublicExperience(id);
  const [availability, user, eligibility, participationRules] = await Promise.all([
    getSlots(id, firstValue(query.month), firstValue(query.date)),
    getCurrentUser(),
    getAccountEligibility(),
    getListingParticipationRules(id),
  ]);
  return (
    <main id="main-content" className="container experience-page">
      <Link href="/discover" className="experience-back">
        ← All experiences
      </Link>
      <header className="experience-heading">
        <span className="eyebrow">
          {listing.category} · {listing.city}
        </span>
        <h1>{listing.title}</h1>
        <div className="experience-facts">
          <Link href={`/hosts/${host.user_id}`} className="text-link">
            With {host.display_name}
          </Link>
          <span>{listing.duration_minutes} minutes</span>
          <span>One participant</span>
          <span>{listing.neighborhood}</span>
        </div>
      </header>
      {photos.length ? (
        <div className={`experience-gallery gallery-count-${Math.min(photos.length, 5)}`}>
          {photos
            .slice(0, 5)
            .map((photo) =>
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
      ) : null}
      <div className="experience-content">
        <div className="experience-story">
          <section>
            <span className="eyebrow">An afternoon with a point of view</span>
            <h2>What you&apos;ll do together.</h2>
            <p className="experience-prose">{listing.description}</p>
          </section>
          <section>
            <span className="eyebrow">The person behind it</span>
            <h2>Meet {host.display_name}.</h2>
            <p className="experience-prose">{host.bio}</p>
            <Link href={`/hosts/${host.user_id}`} className="text-link">
              More about your host →
            </Link>
          </section>
          <section>
            <h2>Where you&apos;ll meet</h2>
            <p>
              {listing.neighborhood}, {listing.city}
            </p>
            <p className="muted">
              Your exact meeting address and arrival instructions are shared after the booking is
              confirmed.
            </p>
          </section>
          <section>
            <h2>Who can join</h2>
            {participationRules ? (
              <ParticipationRulesSummary rules={participationRules} />
            ) : (
              <p className="muted">
                Participation requirements are being reviewed. Booking requests are unavailable
                until that review is complete.
              </p>
            )}
          </section>
          <section>
            <h2>Make it personal.</h2>
            <p>
              Tell your host what you&apos;re curious about when you request a time. You can keep
              planning together in your booking conversation.
            </p>
            <p className="muted">
              Your request needs host acceptance and successful payment before it becomes a
              confirmed booking.
            </p>
          </section>
        </div>
        <aside id="booking" className="panel experience-booking">
          <SlotCalendar
            key={`${availability.calendar.value}-${availability.calendar.selectedDate}-${participationRules?.revision ?? "pending"}`}
            listingId={id}
            {...availability}
            signedIn={Boolean(user)}
            isOwner={user?.id === listing.host_id}
            priceCents={listing.price_cents}
            adultEligible={eligibility?.eligible === true}
            participationRules={participationRules}
          />
        </aside>
      </div>
    </main>
  );
}
