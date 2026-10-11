import Link from "next/link";

export const metadata = { title: "Help & concierge" };
export default function HelpPage() {
  return (
    <main id="main-content" className="container dashboard">
      <div className="dashboard-heading">
        <span className="eyebrow">Good to know</span>
        <h1>A little help, human to human.</h1>
        <p>Qualia is being built for personal experiences in Miami and Miami Beach.</p>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>For guests</h2>
          <h3>What is an experience?</h3>
          <p>
            Time with one host who shares a skill or practice with you, one-on-one. Each published
            listing describes the price, duration, area and host.
          </p>
          <h3>How do requests work?</h3>
          <p>
            Choose an available time and send the host a request. A request is not a confirmed
            booking. Check your booking page for the host&apos;s decision and any payment deadline.
          </p>
          <h3>Can I talk to my host?</h3>
          <p>
            Each booking request has a conversation for you and the host. Use it to agree on
            practical details and ask questions.
          </p>
        </section>
        <section className="panel">
          <h2>For hosts</h2>
          <h3>How do I join?</h3>
          <p>
            Create an account, open your host workspace, and add your profile and experience. You
            can save drafts and preview them before submission.
          </p>
          <h3>What happens after submission?</h3>
          <p>
            Qualia reviews the host, experience, location and relevant risks. A consultation may be
            requested. Only approved experiences are published; review is not a guarantee of safety
            or insurance coverage.
          </p>
          <h3>Can I change a reviewed listing?</h3>
          <p>
            Material changes need another review. Availability has separate controls so existing
            booking commitments stay protected.
          </p>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Have something particular in mind?</h2>
        <p>
          Tell us what you would like to learn and where you would like to meet. We can review your
          idea as the Miami collection grows. We cannot promise that every request can be matched.
        </p>
        <Link className="btn btn-primary" href="/contact">
          Contact Qualia
        </Link>
      </section>
    </main>
  );
}
