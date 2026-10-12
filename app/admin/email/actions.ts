"use server";

import { requireAdmin } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/supabase/config";
import { runEmailDiagnostic, type EmailDiagnosticState } from "@/lib/email/diagnostic";
import { sendWithResend } from "@/lib/email/resend";

export async function sendDiagnosticEmail(
  _previous: EmailDiagnosticState,
  formData: FormData,
): Promise<EmailDiagnosticState> {
  const apiKey = process.env.RESEND_API_KEY;
  return runEmailDiagnostic(formData, {
    requireAdmin,
    from: process.env.EMAIL_FROM,
    siteUrl: getSiteUrl(),
    send: apiKey ? (payload, key) => sendWithResend(payload, key, apiKey) : undefined,
  });
}
