import Link from "next/link";
import { getMyBookings } from "@/lib/booking/data";
import { BookingList } from "@/components/booking/booking-list";
import { effectiveStatus } from "@/lib/booking/validation";

export const metadata = { title: "Your bookings" };

export default async function BookingsPage() {
  const bookings = await getMyBookings("guest");
  const active = bookings.filter((booking) =>
    ["requested", "awaiting_payment", "confirmed"].includes(effectiveStatus(booking)),
  );
  const history = bookings.filter((booking) => !active.includes(booking));
  return (
    <main id="main-content" className="container dashboard">
      <div className="booking-page-heading">
        <div>
          <span className="eyebrow">Your time, well spent</span>
          <h1>Your bookings.</h1>
        </div>
        <Link href="/discover" className="btn btn-outline">
          Find an experience
        </Link>
      </div>
      <nav className="dashboard-nav" aria-label="Account navigation">
        <Link href="/account/dashboard">My account</Link>
        <Link href="/bookings" aria-current="page">
          My bookings
        </Link>
        <Link href="/host/calendar">Host calendar</Link>
      </nav>
      <BookingList bookings={active} role="guest" />
      {history.length ? (
        <section className="booking-history">
          <h2>Past requests &amp; experiences</h2>
          <BookingList bookings={history} role="guest" />
        </section>
      ) : null}
    </main>
  );
}
