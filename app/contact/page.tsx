import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { authIsConfigured } from "@/lib/supabase/config";
import { SupportForm } from "@/components/support/support-form";
import type { SupportRequest } from "@/lib/support/types";
import { getContactEmail } from "@/lib/contact/config";

export const metadata = { title: "Contact Qualia" };

export default async function ContactPage() {
  const contactEmail = getContactEmail();
  const user = await getCurrentUser();
  let requests: SupportRequest[] = [];
  if (user?.email_confirmed_at) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("support_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Your support history could not be loaded.");
    requests = data as SupportRequest[];
  }
  return (
    <main id="main-content" className="container dashboard">
      <div className="dashboard-heading">
        <span className="eyebrow">A real conversation</span>
        <h1>How can we help?</h1>
        <p>
          Ask about hosting, a booking, or an experience you would love to find. Your request goes
          to the Qualia team.
        </p>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Contact &amp; concierge requests</h2>
          {contactEmail ? (
            <p>
              Email the Qualia team at{" "}
              <a className="text-link" href={`mailto:${encodeURIComponent(contactEmail)}`}>
                {contactEmail}
              </a>
              .
            </p>
          ) : null}
          {!authIsConfigured() ? (
            <p className="notice">
              {contactEmail
                ? "Our contact workspace is opening soon. You can reach us by email."
                : "Our contact workspace is opening soon. Please check back before sending a request."}
            </p>
          ) : user?.email_confirmed_at ? (
            <SupportForm />
          ) : (
            <>
              <p>
                Sign in with a confirmed email so we can keep your request and response together.
              </p>
              <Link className="btn btn-primary" href="/login?next=%2Fcontact">
                Sign in to contact Qualia
              </Link>
            </>
          )}
        </section>
        <section className="panel">
          <h2>A little guidance</h2>
          <p>
            For a question about an existing experience, use its booking conversation to reach the
            host directly.
          </p>
          <p>
            For help choosing an experience, tell us your interests, preferred area, and what you
            would like to learn. A request does not reserve a session.
          </p>
          <Link className="text-link" href="/help">
            Read the help page
          </Link>
        </section>
      </div>
      {requests.length ? (
        <section className="section">
          <h2>Your recent requests</h2>
          <div className="form-stack">
            {requests.map((request) => (
              <article className="panel" key={request.id}>
                <span className="status">{request.status}</span>
                <h3 style={{ marginTop: 16 }}>{request.subject}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{request.message}</p>
                {request.response ? (
                  <>
                    <h4>Qualia&apos;s response</h4>
                    <p style={{ whiteSpace: "pre-wrap" }}>{request.response}</p>
                  </>
                ) : (
                  <p className="muted">Waiting for a response.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
