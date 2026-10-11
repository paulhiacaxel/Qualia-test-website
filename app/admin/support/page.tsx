import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SupportForm } from "@/components/support/support-form";
import type { SupportRequest } from "@/lib/support/types";

export const metadata = { title: "Support inbox" };
export default async function SupportInboxPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_requests")
    .select("*")
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("The support inbox could not be loaded.");
  const requests = data as SupportRequest[];
  return (
    <main id="main-content" className="container dashboard">
      <div className="dashboard-heading">
        <span className="eyebrow">Qualia administration</span>
        <h1>Support inbox</h1>
        <p>
          Responses are shown in each member&apos;s contact history. Saving here does not send an
          email.
        </p>
      </div>
      <AdminNav active="support" />
      <div className="form-stack">
        {requests.length ? (
          requests.map((request) => (
            <article className="panel" key={request.id}>
              <span className="status">{request.status}</span>
              <h2 style={{ marginTop: 16 }}>{request.subject}</h2>
              <p className="field-hint">
                Request {request.id} ·{" "}
                {new Date(request.created_at).toLocaleDateString("en-US", {
                  timeZone: "America/New_York",
                })}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{request.message}</p>
              <SupportForm request={request} />
            </article>
          ))
        ) : (
          <section className="panel">
            <h2>No requests yet</h2>
            <p>New contact and concierge requests will appear here.</p>
          </section>
        )}
      </div>
    </main>
  );
}
