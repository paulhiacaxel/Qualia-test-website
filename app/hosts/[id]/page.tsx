import Link from "next/link";
import { getPublicHost } from "@/lib/booking/data";
import { ExperienceCard } from "@/components/booking/experience-card";

export const metadata = { title: "Meet your host" };

export default async function PublicHostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { host, experiences } = await getPublicHost(id);
  return (
    <main id="main-content" className="container experience-page">
      <Link href="/discover" className="experience-back">
        ← Discover Qualia
      </Link>
      <header className="public-host-heading">
        <div className="host-initial" aria-hidden="true">
          {host.display_name[0]}
        </div>
        <div>
          <span className="eyebrow">Your host · {host.city}</span>
          <h1>{host.display_name}</h1>
        </div>
      </header>
      <section className="public-host-bio">
        <p className="experience-prose">{host.bio}</p>
        {host.portfolio_url ? (
          <a
            className="text-link"
            href={host.portfolio_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore my work ↗
          </a>
        ) : null}
      </section>
      <h2 className="collection-title">An afternoon with {host.display_name}.</h2>
      <div className="experience-grid">
        {experiences.map((experience) => (
          <ExperienceCard key={experience.id} experience={experience} />
        ))}
      </div>
    </main>
  );
}
