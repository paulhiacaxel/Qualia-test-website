import {
  bookingModeLabel,
  bookingPartyLabel,
  bookingPriceLabel,
  type BookingPresentation,
} from "../booking/presentation.ts";

export type EmailKind =
  "new_request" | "accepted" | "confirmed" | "cancelled" | "request_closed" | "reminder_24h";
export type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};
export type EmailContext = BookingPresentation & {
  id: string;
  booking_id: string;
  recipient_id: string;
  kind: EmailKind;
  starts_at: string;
  title: string;
  payment_deadline_at: string | null;
  provider_payload: EmailPayload | null;
  first_send_at: string | null;
};

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}
function miamiTime(value: string): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(value)) + " (Miami time)"
  );
}

/** Booking totals/counts only; participant ages, notes and locations stay behind login. */
export function renderBookingEmail(
  context: EmailContext,
  siteUrl: string,
): Omit<EmailPayload, "from" | "to"> {
  const origin = new URL(siteUrl);
  if (
    origin.protocol !== "https:" &&
    !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))
  )
    throw new Error("Invalid email site origin.");
  if (origin.username || origin.password || !/^[0-9a-f-]{36}$/i.test(context.booking_id))
    throw new Error("Invalid booking link.");
  const href = new URL(`/bookings/${context.booking_id}`, origin.origin).href;
  const copy: Record<EmailKind, [string, string, string]> = {
    new_request: [
      "A new experience request",
      "A guest has requested time with you. Open the booking to review the request and respond. This is not a confirmed booking yet.",
      "Review request",
    ],
    accepted: [
      "Your host accepted your request",
      "Your next step is checkout. Your booking is confirmed only after payment has been verified.",
      "Continue to checkout",
    ],
    confirmed: [
      "Your Qualia booking is confirmed",
      "Payment has been verified and your booking is confirmed. Your booking page has the latest details and your conversation.",
      "View booking",
    ],
    cancelled: [
      "Your Qualia booking was cancelled",
      "This booking has been cancelled. Open the booking for its current status. Any payment or refund questions can be sent to Qualia support.",
      "View booking",
    ],
    request_closed: [
      "Your booking request has closed",
      "This request is no longer available to confirm. Open the booking to see its current status.",
      "View request",
    ],
    reminder_24h: [
      "Your Qualia experience is coming up",
      "Your confirmed experience starts within the next 24 hours. Check your booking page for the latest details and messages before you go.",
      "View booking",
    ],
  };
  const [subject, body, cta] = copy[context.kind];
  const title = context.title.trim() || "Your experience";
  const time = miamiTime(context.starts_at);
  const format = context.booking_mode
    ? `${bookingModeLabel(context.booking_mode)} · ${bookingPartyLabel(context.party_size)}`
    : "";
  const price = bookingPriceLabel(context);
  const summary = [format, price].filter(Boolean).join("\n");
  let deadline = "";
  if (context.kind === "accepted" && context.payment_deadline_at) {
    // Keep the start-payment cutoff separate from completion, just as on the
    // booking page. Existing provider_payload rows remain frozen by the worker.
    const payBy = Math.min(Date.parse(context.starts_at), Date.parse(context.payment_deadline_at));
    const openBy = new Date(payBy - 31 * 60_000).toISOString();
    deadline = `Start a new checkout before ${miamiTime(openBy)}. Complete payment by ${miamiTime(new Date(payBy).toISOString())}. If you have already opened checkout, return to your booking to resume it and check its current expiry.`;
  }
  const text = `QUALIA\n\n${subject}\n\n${title}\n${time}${summary ? `\n${summary}` : ""}\n\n${body}${deadline ? `\n\n${deadline}` : ""}\n\n${cta}: ${href}\n\nThis is a service message about your booking. Sign in to see private meeting details.`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f4f1e8;color:#26372d;font-family:Inter,Arial,sans-serif;font-size:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px"><table role="presentation" style="max-width:560px;margin:auto;background:#fffdf7;border:1px solid #d9dccf" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:32px"><p style="font-family:'IBM Plex Mono',monospace;letter-spacing:4px;color:#56644a">QUALIA</p><h1 style="font-family:Fraunces,Georgia,serif;font-weight:500;font-size:30px">${escapeHtml(subject)}</h1><h2 style="font-family:Fraunces,Georgia,serif;font-weight:400">${escapeHtml(title)}</h2><p>${escapeHtml(time)}</p>${format ? `<p>${escapeHtml(format)}</p>` : ""}${price ? `<p>${escapeHtml(price)}</p>` : ""}<p style="line-height:1.7">${escapeHtml(body)}</p>${deadline ? `<p>${escapeHtml(deadline)}</p>` : ""}<p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#4d614b;color:#fffdf7;padding:14px 22px;border-bottom:3px solid #bba165;text-decoration:none">${escapeHtml(cta)}</a></p><p style="font-size:12px;color:#68705f;line-height:1.6">This is a service message about your booking. Sign in to see private meeting details.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
