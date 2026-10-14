import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { assistedHostCatalog } from "@/lib/host/assisted/catalog";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { ActionForm } from "@/components/host/action-form";
import { prepareAndInviteHost } from "./actions";
export const metadata = { title: "Prepared host listings" };
export default async function PreparedHostsPage() {
  await requireAdmin();
  const db = await createClient();
  const records = await Promise.all(
    Object.entries(assistedHostCatalog).map(async ([key, host]) => {
      const { data, error } = await db.rpc("admin_get_assisted_host", { p_source_key: key });
      if (error) throw new Error("Prepared host records could not be loaded.");
      return {
        key,
        host,
        record: data as {
          invite_state: string;
          listing_id: string | null;
          confirmed_at: string | null;
          sent_at: string | null;
        } | null,
      };
    }),
  );
  return (
    <DashboardShell title="A page ready for its host." eyebrow="Host setup">
      <AdminNav active="hosts" />
      <p>
        Prepare the reviewed copy for a host who has agreed to join. The invitation lets them choose
        their own password and confirm their details. It does not accept agreements or publish on
        their behalf.
      </p>
      {records.map(({ key, host, record }) => (
        <section className="panel" key={key}>
          <h2>{host.name}</h2>
          <p>{host.email}</p>
          <p>
            {host.listing.title} · {host.listing.duration_minutes} minutes
          </p>
          <p>
            <Link href={host.previewPath} target="_blank">
              Open prepared preview ↗
            </Link>
          </p>
          {record ? (
            <>
              <p>
                Invitation:{" "}
                {record.invite_state === "accepted"
                  ? "Accepted by email provider"
                  : record.invite_state.replaceAll("_", " ")}
              </p>
              <p>
                {record.confirmed_at
                  ? "Host confirmed the prepared page."
                  : "Waiting for host setup and confirmation."}
              </p>
              <p>
                {record.listing_id
                  ? `Draft reference: ${record.listing_id}`
                  : "Draft preparation needs review."}
              </p>
            </>
          ) : (
            <ActionForm
              action={prepareAndInviteHost}
              label={`Prepare listing and invite ${host.name}`}
            >
              <input type="hidden" name="sourceKey" value={key} />
              <p>This sends one secure account email to {host.email}.</p>
            </ActionForm>
          )}
        </section>
      ))}
    </DashboardShell>
  );
}
