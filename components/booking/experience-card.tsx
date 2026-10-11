import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/host/validation";
import type { PublicExperience } from "@/lib/booking/types";

export function ExperienceCard({ experience }: { experience: PublicExperience }) {
  return (
    <article className="experience-card">
      <Link
        href={`/experiences/${experience.id}`}
        className="experience-card-image"
        aria-label={`View ${experience.title}`}
      >
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
          <Link href={`/experiences/${experience.id}`}>{experience.title}</Link>
        </h2>
        <p>
          With {experience.host?.display_name ?? "your host"} · {experience.duration_minutes}{" "}
          minutes
        </p>
        <div className="experience-card-price">
          <strong>{formatMoney(experience.price_cents)}</strong>
          <span>per one-on-one session</span>
        </div>
      </div>
    </article>
  );
}
