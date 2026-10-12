import type { EmailPayload } from "./render";
import type { SendResult } from "./resend";

export type EmailDiagnosticState = { error?: string; providerId?: string };
type VerifiedAdmin = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
};
type Dependencies = {
  requireAdmin: () => Promise<VerifiedAdmin>;
  from?: string;
  siteUrl: string | null;
  send?: (payload: EmailPayload, key: string) => Promise<SendResult>;
  now?: Date;
};

/** Fixed copy is shared by the preview and sender; no form content enters an email. */
export function diagnosticMessage(siteUrl: string) {
  const url = new URL(siteUrl);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  )
    throw new Error("Invalid diagnostic origin.");
  const subject = "Qualia email delivery test";
  const text = `Hi,\n\nThis is the Qualia email delivery test you requested from your admin account at ${url.origin}.\n\nNo booking was created and no payment was taken. Please reply to confirm it arrived.\n\nQualia`;
  const escaped = text.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
  return {
    subject,
    text,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><p>${escaped.replaceAll("\n", "<br>")}</p></body></html>`,
  };
}

/** Manual admin diagnostic only. It neither claims jobs nor changes the worker switch. */
export async function runEmailDiagnostic(
  formData: FormData,
  { requireAdmin, from, siteUrl, send, now = new Date() }: Dependencies,
): Promise<EmailDiagnosticState> {
  // Keep the authorization outside the send-error handler: redirects/rejections
  // from the real server-side admin guard must propagate without sending.
  const user = await requireAdmin();
  if (!user.email || !user.email_confirmed_at || user.is_anonymous)
    return { error: "A verified admin email address is required." };
  if (formData.get("confirm") !== "on")
    return { error: "Review the test message and confirm its recipient before sending." };
  if (!from || !siteUrl || !send)
    return { error: "The email sender is not configured for this deployment." };
  try {
    const payload: EmailPayload = { from, to: [user.email], ...diagnosticMessage(siteUrl) };
    // Double clicks and same-day retries reuse one provider request. A changed
    // sender/address/copy under this key fails closed with a provider conflict.
    const key = `qualia-email-diagnostic/v1/${user.id}/${now.toISOString().slice(0, 10)}`;
    const result = await send(payload, key);
    if (result.accepted) return { providerId: result.id };
    return {
      error: result.retryable
        ? "The provider outcome is uncertain or temporarily unavailable. Retrying today reuses the same test request. Check Resend before starting a test on another day."
        : "The provider did not accept this test. Check the sender configuration and Resend logs before retrying.",
    };
  } catch {
    return { error: "The test could not be completed. Check Resend before retrying." };
  }
}
