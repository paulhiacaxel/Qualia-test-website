import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/host/validation";
import type { BookingMode, PublicExperience } from "@/lib/booking/types";

export function ExperienceCard({
  experience,
  bookingMode,
  partySize,
}: {
  experience: PublicExperience;
  bookingMode?: BookingMode;
  partySize?: number;
}) {
  const showSharedPrice =
    bookingMode !== "private" &&
    experience.booking_format !== "private" &&
    typeof experience.shared_price_cents === "number";
  const query = new URLSearchParams({ mode: showSharedPrice ? "shared" : "private" });
  if (partySize) query.set("guests", String(partySize));
  const href = `/experiences/${experience.id}?${query.toString()}`;
  const displayPrice = showSharedPrice ? experience.shared_price_cents! : experience.price_cents;
  const priceLabel = showSharedPrice
    ? "per guest · shared"
    : experience.private_price_basis === "per_guest"
      ? "per guest · private"
      : "per private group";
  return (
    <article className="experience-card">
      <Link href={href} className="experience-card-image" aria-label={`View ${experience.title}`}>
        {experience.coverUrl ? (
          <Image
            src={experience.coverUrl}
            alt={experience.coverAlt ?? ""}
            width={720}
            height={540}
            unoptimized
          />
        ) : (
          <div className="experience-photo-empty">{experience.category}</div>
        )}
      </Link>
      <div className="experience-card-body">
        <span className="eyebrow">
          {experience.category} · {experience.city}
        </span>
        <h2>
          <Link href={href}>{experience.title}</Link>
        </h2>
        <p>
          With {experience.host?.display_name ?? "your host"} · {experience.duration_minutes}{" "}
          minutes
        </p>
        <p>
          {experience.booking_format === "both"
            ? "Private or shared"
            : experience.booking_format === "shared"
              ? "Shared experience"
              : "Private experience"}{" "}
          · Up to {experience.max_guests} {experience.max_guests === 1 ? "guest" : "guests"}
        </p>
        <div className="experience-card-price">
          <strong>{formatMoney(displayPrice)}</strong>
          <span>{priceLabel}</span>
        </div>
      </div>
    </article>
  );
}
