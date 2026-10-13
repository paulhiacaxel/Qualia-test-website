import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  requireUser,
  getProfile,
  getAccountEligibility,
  getLegalAcceptance,
} from "@/lib/auth/session";
import { getMyBookings } from "@/lib/booking/data";
import { BookingList } from "@/components/booking/booking-list";
import { effectiveStatus } from "@/lib/booking/validation";
import "@/components/booking/booking.css";

export const metadata = { title: "Your account" };
export default async function AccountPage() {
  const user = await requireUser();
  const [profile, bookings, eligibility, agreements] = await Promise.all([
    getProfile(),
    getMyBookings("guest"),
    getAccountEligibility(),
    getLegalAcceptance(),
  ]);
  const activeBookings = bookings
    .filter(
      (booking) =>
        ["requested", "awaiting_payment", "confirmed"].includes(effectiveStatus(booking)) &&
        Date.parse(booking.ends_at) > Date.now(),
    )
    .slice(0, 3);
  return (
    <DashboardShell
      title={profile?.full_name ? `Welcome, ${profile.full_name}.` : "Welcome to Qualia."}
      eyebrow="Your account"
    >
      {!eligibility?.eligible ? (
        <section className="panel" style={{ marginBottom: 24 }}>
          <h2>Confirm your account eligibility</h2>
          <p>
            Qualia accounts are for adults 18 and older. A parent or legal guardian can book an
            approved experience for an eligible minor.
          </p>
          <Link className="btn btn-primary" href="/account/eligibility">
            Confirm before booking or hosting
          </Link>
        </section>
      ) : null}
      {eligibility?.eligible && !agreements.guest_accepted ? (
        <section className="panel" style={{ marginBottom: 24 }}>
          <h2>Review your Qualia agreements</h2>
          <p>Read the terms, cancellation policy and privacy notice before making a new booking.</p>
          <Link className="btn btn-primary" href="/account/agreements">
            Review and continue
          </Link>
        </section>
      ) : null}
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Your details</h2>
          <dl className="details">
            <div>
              <dt>Name</dt>
              <dd>{profile?.full_name || "Not added yet"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{profile?.is_host ? "Guest and host" : "Guest"}</dd>
            </div>
          </dl>
          <span className="status">Email confirmed</span>
          <p style={{ marginTop: 20, marginBottom: 0 }}>
            <Link className="text-link" href="/account/profile">
              Edit account details
            </Link>
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">A little curiosity goes a long way</span>
          <h2>Your next experience starts here.</h2>
          <p>
            Explore the Miami collection, request a time, and keep every conversation with your host
            in one place.
          </p>
          <div className="button-row">
            <Link className="btn btn-primary" href="/discover">
              Explore Qualia
            </Link>
            <Link
              className="btn btn-outline"
              href={profile?.is_host ? "/host/dashboard" : "/host/start"}
            >
              {profile?.is_host ? "Host workspace" : "Become a host"}
            </Link>
          </div>
        </section>
      </div>
      <section className="booking-history">
        <div className="booking-page-heading">
          <h2>Your next afternoons</h2>
          <Link className="text-link" href="/bookings">
            View all bookings
          </Link>
        </div>
        <BookingList bookings={activeBookings} role="guest" />
      </section>
    </DashboardShell>
  );
}
