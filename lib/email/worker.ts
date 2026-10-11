import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailContext, EmailPayload } from "./render";
import type { SendResult } from "./resend";

type Job = { id: string; lease_token: string; recipient_id: string; attempts: number };
type Dependencies = {
  client: SupabaseClient;
  from: string;
  render: (context: EmailContext) => Omit<EmailPayload, "from" | "to">;
  send: (payload: EmailPayload, key: string) => Promise<SendResult>;
};

/** The only caller is an authenticated server job. Dependencies keep tests offline. */
export async function runEmailBatch({ client, from, render, send }: Dependencies) {
  const claimed = await client.rpc("email_claim_jobs", { p_limit: 5 });
  if (claimed.error) throw new Error("Email queue unavailable.");
  const stats = { claimed: 0, accepted: 0, skipped: 0, retried: 0, failed: 0, errors: 0 };
  for (const job of (claimed.data ?? []) as Job[]) {
    stats.claimed++;
    const finish = async (
      outcome: string,
      code: string | null = null,
      providerId: string | null = null,
    ) => {
      const result = await client.rpc("email_finish_job", {
        p_id: job.id,
        p_lease_token: job.lease_token,
        p_outcome: outcome,
        p_error_code: code,
        p_provider_id: providerId,
      });
      if (result.error || result.data !== true) throw new Error("Email outcome was not persisted.");
    };
    const context = async () => {
      const result = await client.rpc("email_job_context", {
        p_id: job.id,
        p_lease_token: job.lease_token,
      });
      if (result.error) throw new Error("Email state unavailable.");
      return result.data as EmailContext | null;
    };
    try {
      const current = await context();
      if (!current) {
        stats.skipped++;
        continue;
      }
      // Recipient comes exclusively from the booking-owned Auth user ID.
      const account = await client.auth.admin.getUserById(current.recipient_id);
      if (account.error) throw new Error("Account lookup unavailable.");
      const user = account.data.user;
      if (!user?.email || !user.email_confirmed_at || user.is_anonymous) {
        await finish("skipped", "recipient_unverified_or_missing");
        stats.skipped++;
        continue;
      }
      const candidate = current.provider_payload ?? { ...render(current), from, to: [user.email] };
      // A changed account email never redirects a retry using an existing key.
      if (candidate.to.length !== 1 || candidate.to[0] !== user.email) {
        await finish("skipped", "recipient_changed");
        stats.skipped++;
        continue;
      }
      const prepared = await client.rpc("email_prepare_send", {
        p_id: job.id,
        p_lease_token: job.lease_token,
        p_payload: candidate,
      });
      if (prepared.error) throw new Error("Email could not be prepared.");
      if (!prepared.data) {
        stats.skipped++;
        continue;
      }
      // Final authoritative preflight suppresses cancelled/expired/stale reminders.
      if (!(await context())) {
        stats.skipped++;
        continue;
      }
      const result = await send(prepared.data as EmailPayload, `qualia-booking/${job.id}`);
      if (result.accepted) {
        await finish("accepted", null, result.id);
        stats.accepted++;
      } else {
        await finish(result.retryable ? "retry" : "failed", result.code);
        if (result.retryable) stats.retried++;
        else stats.failed++;
      }
    } catch {
      stats.errors++;
      // If persistence fails after provider acceptance, lease recovery replays the
      // same request/key. Never create a fresh outbox row for the retry.
      try {
        await finish("retry", "worker_dependency_error");
        stats.retried++;
      } catch {
        /* Leave lease for recovery. */
      }
    }
  }
  return stats;
}
