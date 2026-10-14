"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/supabase/config";
import { assistedHost } from "@/lib/host/assisted/catalog";
import { escapeHtml } from "@/lib/email/render";
import { sendWithResend } from "@/lib/email/resend";
import type { HostActionState } from "@/lib/host/types";

/** Explicit operator action only. Auth tokens never enter logs, state or the client. */
export async function prepareAndInviteHost(
  _state: HostActionState,
  form: FormData,
): Promise<HostActionState> {
  await requireAdmin();
  const key = form.get("sourceKey");
  const prepared = assistedHost(key);
  if (!prepared || typeof key !== "string") return { error: "Choose a reviewed host proposal." };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const siteUrl = getSiteUrl();
  if (!apiKey || !from || !siteUrl) return { error: "Invitation email is not configured." };
  const db = await createClient();
  const { data: reserved, error: reserveError } = await db.rpc("admin_reserve_assisted_host", {
    p_source_key: key,
    p_email: prepared.email,
  });
  if (reserveError || reserved !== true)
    return {
      error:
        "An invitation or account already exists. Check its status before sending anything else.",
    };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: prepared.email,
      options: { data: { full_name: prepared.name }, redirectTo: `${siteUrl}/host/welcome` },
    });
    if (error || !data.user?.id || !data.properties?.hashed_token)
      throw new Error("invite_creation_failed");
    const { error: prepareError } = await db.rpc("admin_prepare_assisted_listing", {
      p_source_key: key,
      p_host_id: data.user.id,
      p_profile: prepared.profile,
      p_listing: prepared.listing,
    });
    if (prepareError) throw new Error("listing_preparation_failed");
    const url = new URL("/auth/confirm", siteUrl);
    url.searchParams.set("type", "invite");
    url.searchParams.set("token_hash", data.properties.hashed_token);
    url.searchParams.set("next", "/host/welcome");
    const link = url.toString();
    const result = await sendWithResend(
      {
        from,
        to: [prepared.email],
        subject: "Your Qualia host account and prepared listing",
        html: `<html lang="en"><body><p>Hi ${escapeHtml(prepared.name)},</p><p>Your experience page is prepared. Use this secure link to choose your password and take over your host workspace:</p><p><a href="${escapeHtml(link)}">Set up your account and review your listing</a></p><p>The copy and photos are ready for you. You’ll confirm the price and guest limit, review the hosting terms, then add your meeting details and availability. Bookings open after review and payout setup.</p><p>This link can be used once. If it expires, reply to contact@bookqualia.com and we’ll help.</p><p>Qualia<br><a href="https://bookqualia.com">bookqualia.com</a></p></body></html>`,
        text: `Hi ${prepared.name},\n\nYour experience page is prepared. Choose your password and take over your workspace: ${link}\n\nThe copy and photos are ready for you. Confirm pricing and guest limit, review hosting terms, then add meeting details and availability. Bookings open after review and payout setup.\n\nThis link can be used once. If it expires, reply to contact@bookqualia.com for help.\n\nQualia\nhttps://bookqualia.com`,
      },
      `assisted-host/${key}/initial`,
      apiKey,
    );
    const { error: recordError } = await db.rpc("admin_finish_assisted_invite", {
      p_source_key: key,
      p_state: result.accepted ? "accepted" : "needs_attention",
      p_provider_id: result.accepted ? result.id : null,
    });
    if (!result.accepted || recordError)
      return {
        error:
          "The draft is saved. Check invitation delivery before retrying; no automatic resend was made.",
      };
  } catch {
    await db.rpc("admin_finish_assisted_invite", {
      p_source_key: key,
      p_state: "needs_attention",
      p_provider_id: null,
    });
    return {
      error:
        "Setup needs operator review. No password or sign-in link was exposed. Check the invitation record before retrying.",
    };
  }
  revalidatePath("/admin/hosts");
  return {
    success:
      "The private draft is prepared and the invitation was accepted by the email provider. The host must complete setup before publication.",
  };
}
