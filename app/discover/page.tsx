import Link from "next/link";
import { Aperture } from "@/components/aperture";

export const metadata = { title: "Discover Miami" };
export default function DiscoverPage() {
  return (
    <main id="main-content" className="container dashboard">
      <span className="eyebrow">Discover · Miami &amp; Miami Beach</span>
      <div className="empty-state panel">
        <Aperture />
        <h2>Something personal is taking shape.</h2>
        <p>
          We&apos;re bringing together our first Miami hosts. Experiences will appear here after
          review, and bookings will open when we&apos;re ready.
        </p>
        <div className="button-row">
          <Link className="btn btn-primary" href="/signup?role=host">
            Become a founding host
          </Link>
          <Link className="btn btn-outline" href="/">
            Meet Qualia
          </Link>
        </div>
      </div>
    </main>
  );
}
