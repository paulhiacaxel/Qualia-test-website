import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import type { Booking, BookingStatus } from "./types";
import { groupParticipantSchema, participantSchema } from "../participation/validation.ts";

const MIAMI_TIME_ZONE = "America/New_York";

export const bookingRequestSchema = z.object({
  listingId: z.uuid("Choose an experience."),
  startsAt: z.iso.datetime({ offset: true, message: "Choose an available time." }),
  guestMessage: z.string().trim().max(3000),
  participant: participantSchema,
});

/** Read only the participation fields we collect; no child identity or health data. */
export function bookingRequestInput(formData: FormData) {
  const integer = (value: FormDataEntryValue | null) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  return {
    listingId: formData.get("listingId"),
    startsAt: formData.get("startsAt"),
    guestMessage: formData.get("guestMessage") ?? "",
    participant: {
      kind: formData.get("participantKind"),
      age_at_experience: integer(formData.get("participantAge")),
      adult_booker_confirmed: formData.get("adultBookerConfirmed") === "on",
      rules_accepted: formData.get("participationRulesAccepted") === "on",
      guardian_authority_confirmed: formData.get("guardianAuthorityConfirmed") === "on",
      guardian_presence_accepted: formData.get("guardianPresenceAccepted") === "on",
      rules_revision: integer(formData.get("rulesRevision")),
    },
  };
}

/** Group requests carry ages and acknowledgments, never names or birth dates. */
export const groupBookingRequestSchema = z
  .object({
    listingId: z.uuid("Choose an experience."),
    startsAt: z.iso.datetime({ offset: true, message: "Choose an available time." }),
    guestMessage: z.string().trim().max(3000),
    bookingMode: z.enum(["private", "shared"]),
    partySize: z.number().int().min(1).max(50),
    participants: groupParticipantSchema,
  })
  .superRefine((value, context) => {
    if (value.participants.members.length !== value.partySize) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Add an age for every guest in your party.",
      });
    }
  });

export function groupBookingRequestInput(formData: FormData) {
  const integer = (value: FormDataEntryValue | null) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const partySize = integer(formData.get("partySize"));
  // Bound form parsing before allocation; the schema rejects an invalid count.
  const count = Number.isInteger(partySize) && partySize >= 1 && partySize <= 50 ? partySize : 0;
  return {
    listingId: formData.get("listingId"),
    startsAt: formData.get("startsAt"),
    guestMessage: formData.get("guestMessage") ?? "",
    bookingMode: formData.get("bookingMode"),
    partySize,
    participants: {
      members: Array.from({ length: count }, (_, index) => {
        const age = integer(formData.get(`participantAge${index}`));
        return {
          kind:
            formData.get(`participantGuardian${index}`) === "on"
              ? "guardian"
              : age < 18
                ? "minor"
                : "adult",
          age_at_experience: age,
        };
      }),
      adult_booker_confirmed: formData.get("adultBookerConfirmed") === "on",
      rules_accepted: formData.get("participationRulesAccepted") === "on",
      guardian_authority_confirmed: formData.get("guardianAuthorityConfirmed") === "on",
      guardian_presence_accepted: formData.get("guardianPresenceAccepted") === "on",
      group_authority_confirmed: formData.get("groupAuthorityConfirmed") === "on",
      rules_revision: integer(formData.get("rulesRevision")),
    },
  };
}

/** Invalid URL filters use a safe default; they never become raw database filters. */
export function parseGuestCount(value?: string): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 50 ? count : undefined;
}

export function bookingSelection(
  listing: { booking_format: "private" | "shared" | "both"; max_guests: number },
  mode?: string,
  guests?: string,
) {
  const bookingMode =
    listing.booking_format === "shared" || (listing.booking_format === "both" && mode === "shared")
      ? ("shared" as const)
      : ("private" as const);
  const partySize = Math.min(parseGuestCount(guests) ?? 1, listing.max_guests);
  return { bookingMode, partySize };
}

export const bookingMessageSchema = z.object({
  bookingId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(3000, "Keep your message to 3,000 characters or fewer."),
});

export const bookingResponseSchema = z.object({
  bookingId: z.uuid(),
  decision: z.enum(["accept", "decline"]),
});

/** Slot APIs operate in UTC; the date navigation remains explicitly Miami-local. */
export function calendarMonth(value?: string, now = Temporal.Now.instant()) {
  const current = now.toZonedDateTimeISO(MIAMI_TIME_ZONE).toPlainDate().toPlainYearMonth();
  let month = current;
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    try {
      const parsed = Temporal.PlainYearMonth.from(value);
      if (
        Temporal.PlainYearMonth.compare(parsed, current) >= 0 &&
        Temporal.PlainYearMonth.compare(parsed, current.add({ months: 18 })) <= 0
      )
        month = parsed;
    } catch {
      /* Invalid query parameters use the current month. */
    }
  }
  const start = month
    .toPlainDate({ day: 1 })
    .toZonedDateTime({ timeZone: MIAMI_TIME_ZONE, plainTime: "00:00" })
    .toInstant();
  const end = month
    .add({ months: 1 })
    .toPlainDate({ day: 1 })
    .toZonedDateTime({ timeZone: MIAMI_TIME_ZONE, plainTime: "00:00" })
    .toInstant();
  return {
    value: month.toString(),
    from: (Temporal.Instant.compare(start, now) < 0 ? now : start).toString(),
    until: end.toString(),
    days: month.daysInMonth,
    firstWeekday: month.toPlainDate({ day: 1 }).dayOfWeek % 7,
    previous:
      Temporal.PlainYearMonth.compare(month, current) > 0
        ? month.subtract({ months: 1 }).toString()
        : null,
    next:
      Temporal.PlainYearMonth.compare(month, current.add({ months: 18 })) < 0
        ? month.add({ months: 1 }).toString()
        : null,
    label: month
      .toPlainDate({ day: 1 })
      .toLocaleString("en-US", { month: "long", year: "numeric" }),
  };
}

export function miamiDateKey(value: string) {
  return Temporal.Instant.from(value).toZonedDateTimeISO(MIAMI_TIME_ZONE).toPlainDate().toString();
}

export function calendarDay(date: string) {
  const day = Temporal.PlainDate.from(date);
  return {
    from: day
      .toZonedDateTime({ timeZone: MIAMI_TIME_ZONE, plainTime: "00:00" })
      .toInstant()
      .toString(),
    until: day
      .add({ days: 1 })
      .toZonedDateTime({ timeZone: MIAMI_TIME_ZONE, plainTime: "00:00" })
      .toInstant()
      .toString(),
  };
}

export function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MIAMI_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

type BookingStatusInput = Pick<
  Booking,
  "status" | "request_expires_at" | "payment_deadline_at" | "payment_hold_active"
>;

/** Only the server can release a financial hold: an in-flight payment may settle
 * after the original booking deadline, so the clock alone cannot expire it. */
export function effectiveStatus(booking: BookingStatusInput, now = Date.now()): BookingStatus {
  if (
    booking.status === "requested" &&
    booking.request_expires_at &&
    Date.parse(booking.request_expires_at) <= now
  )
    return "expired";
  if (
    booking.status === "awaiting_payment" &&
    !booking.payment_hold_active &&
    booking.payment_deadline_at &&
    Date.parse(booking.payment_deadline_at) <= now
  )
    return "expired";
  return booking.status;
}

export const statusLabels: Record<BookingStatus, string> = {
  requested: "Request sent",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
};

export function bookingStatusLabel(booking: BookingStatusInput, now = Date.now()) {
  const status = effectiveStatus(booking, now);
  return status === "awaiting_payment" && booking.payment_hold_active
    ? "Checkout in progress"
    : statusLabels[status];
}
