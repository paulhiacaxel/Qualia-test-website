import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/supabase/config";
import { isEmailJobAuthorized } from "@/lib/email/job-auth";
import { renderBookingEmail } from "@/lib/email/render";
import { sendWithResend } from "@/lib/email/resend";
import { runEmailBatch } from "@/lib/email/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isEmailJobAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const siteUrl = getSiteUrl();
  // A deliberate kill switch keeps deployments with copied credentials inert.
  if (process.env.TRANSACTIONAL_EMAIL_ENABLED !== "true" || !apiKey || !from || !siteUrl)
    return Response.json(
      { error: "Transactional email is not enabled/configured." },
      { status: 503 },
    );
  try {
    const result = await runEmailBatch({
      client: createAdminClient(),
      from,
      render: (context) => renderBookingEmail(context, siteUrl),
      send: (payload, key) => sendWithResend(payload, key, apiKey),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Email worker unavailable." }, { status: 503 });
  }
}
