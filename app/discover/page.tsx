import Link from "next/link";
import { listExperiences } from "@/lib/booking/data";
import { categories, cities } from "@/lib/host/validation";
import { firstValue } from "@/lib/auth/validation";
import { ExperienceCard } from "@/components/booking/experience-card";

export const metadata = { title: "Discover Miami" };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoryValue = firstValue(params.category);
  const cityValue = firstValue(params.city);
  const category = categories.includes(categoryValue as (typeof categories)[number])
    ? categoryValue
    : "";
  const city = cities.includes(cityValue as (typeof cities)[number]) ? cityValue : "";
  const { experiences } = await listExperiences({ category, city });
  return (
    <main id="main-content" className="container">
      <header className="discovery-heading">
        <span className="eyebrow">Miami / Miami Beach</span>
        <h1>Follow a little curiosity.</h1>
        <p>
          Find your person, learn something new, and see a familiar place from a different point of
          view.
        </p>
      </header>
      <form action="/discover" className="discovery-filters">
        <div>
          <label className="field-label" htmlFor="discover-category">
            What are you curious about?
          </label>
          <select
            id="discover-category"
            name="category"
            className="field-input"
            defaultValue={category}
          >
            <option value="">All experiences</option>
            {categories.map((value) => (
              <option value={value} key={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="discover-city">
            Where?
          </label>
          <select id="discover-city" name="city" className="field-input" defaultValue={city}>
            <option value="">Miami &amp; Miami Beach</option>
            {cities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">
          Find experiences
        </button>
      </form>
      {experiences.length ? (
        <div className="experience-grid">
          {experiences.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
        </div>
      ) : (
        <section className="panel discovery-empty">
          <span className="eyebrow">A collection in the making</span>
          <h2>
            {category || city ? "Nothing here just yet." : "Something personal is taking shape."}
          </h2>
          <p>
            {category || city
              ? "No published experiences match these filters yet. Try another category or location."
              : "We’re bringing together our first Miami hosts. Experiences appear here after review and publication."}
          </p>
          <div className="button-row">
            {category || city ? (
              <Link href="/discover" className="btn btn-primary">
                View all experiences
              </Link>
            ) : (
              <Link href="/signup?role=host" className="btn btn-primary">
                Become a host
              </Link>
            )}
            <Link href="/contact" className="btn btn-outline">
              Ask Qualia for help
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
