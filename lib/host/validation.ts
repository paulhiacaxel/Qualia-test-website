import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import {
  categories,
  cities,
  bookingFormats,
  privatePriceBases,
  resourceKinds,
  MAX_LISTING_GUESTS,
} from "./options.ts";
export {
  categories,
  cities,
  bookingFormats,
  privatePriceBases,
  resourceKinds,
  MAX_LISTING_GUESTS,
} from "./options.ts";

export const MIAMI_TIME_ZONE = "America/New_York";
export const idSchema = z.uuid("This item could not be found.");

export const hostProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter the name guests should see.").max(120),
  bio: z.string().trim().max(5000),
  city: z.enum(cities),
  portfolioUrl: z.union([
    z.literal(""),
    z
      .url("Enter a full website address, starting with https://.")
      .max(2048)
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }, "Use an https:// link without sign-in information."),
  ]),
});

/** Parse dollars as decimal digits, never binary floating-point multiplication. */
export function dollarsToCents(value: string): number {
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a price with up to two decimal places.");
  const [whole, fractional = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 10_000_000)
    throw new Error("Enter a price between $0.01 and $100,000.");
  return cents;
}

const optionalPrice = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    try {
      return dollarsToCents(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Enter a valid price.",
      });
      return z.NEVER;
    }
  });

const listingInputSchema = z
  .object({
    title: z.string().trim().min(3, "Give your experience a short title.").max(160),
    description: z.string().trim().max(20000),
    category: z.enum(categories),
    price: optionalPrice,
    bookingFormat: z.enum(bookingFormats).default("private"),
    maxGuests: z.coerce
      .number()
      .int("Use a whole number of guests.")
      .min(1, "Allow at least one guest.")
      .max(MAX_LISTING_GUESTS, `Allow up to ${MAX_LISTING_GUESTS} guests.`)
      .default(1),
    privatePriceBasis: z.enum(privatePriceBases).default("group"),
    sharedPrice: optionalPrice,
    resourceIds: z.array(idSchema).max(10, "Choose up to 10 resources.").default([]),
    durationMinutes: z.coerce
      .number()
      .int()
      .min(1, "Enter the duration in minutes.")
      .max(1440, "A session can be up to 24 hours."),
    city: z.enum(cities),
    neighborhood: z.string().trim().max(120),
  })
  .superRefine((value, context) => {
    if (value.bookingFormat !== "shared" && value.price === undefined) {
      context.addIssue({
        code: "custom",
        path: ["price"],
        message: "Enter a private session price.",
      });
    }
    if (value.bookingFormat !== "private" && value.sharedPrice === undefined) {
      context.addIssue({
        code: "custom",
        path: ["sharedPrice"],
        message: "Enter the shared price per guest.",
      });
    }
    if (new Set(value.resourceIds).size !== value.resourceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["resourceIds"],
        message: "Choose each resource only once.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    // Shared-only listings retain the per-seat amount in the legacy price column.
    // Guest totals are still quoted by the database, never trusted from this form.
    price: (value.bookingFormat === "shared" ? value.sharedPrice : value.price) as number,
    sharedPrice: value.bookingFormat === "private" ? null : (value.sharedPrice as number),
    privatePriceBasis:
      value.bookingFormat === "shared" ? ("group" as const) : value.privatePriceBasis,
  }));

export const listingSchema = z.preprocess((input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = input as Record<string, unknown>;
  // Hidden options can survive an old browser form or a format change. Only
  // prices for the currently offered format should block or alter the save.
  if (value.bookingFormat === "shared")
    return { ...value, price: undefined, privatePriceBasis: undefined };
  if (value.bookingFormat === "private" || value.bookingFormat === undefined)
    return { ...value, sharedPrice: undefined };
  return input;
}, listingInputSchema);

export const hostResourceSchema = z.object({
  resourceId: z.union([idSchema, z.literal("")]).optional(),
  label: z.string().trim().min(2, "Give this resource a name you can recognize.").max(120),
  kind: z.enum(resourceKinds),
});

export const locationSchema = z.object({
  addressLine1: z.string().trim().min(3, "Enter your meeting address.").max(250),
  addressLine2: z.string().trim().max(250),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a US ZIP code."),
  meetingInstructions: z.string().trim().max(3000),
});

export const accountProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(100),
});

/** A datetime-local field has no zone. Miami DST gaps and overlaps are rejected. */
export function miamiLocalToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a date and time.");
  try {
    return Temporal.PlainDateTime.from(value)
      .toZonedDateTime(MIAMI_TIME_ZONE, { disambiguation: "reject" })
      .toInstant()
      .toString();
  } catch {
    throw new Error(
      "That Miami time is invalid or repeats during a daylight-saving change. Choose another time.",
    );
  }
}

export function validateAvailability(
  start: string,
  end: string,
  durationMinutes: number,
  now = Date.now(),
) {
  const startsAt = miamiLocalToUtc(start);
  const endsAt = miamiLocalToUtc(end);
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (startMs <= now) throw new Error("Availability must begin in the future.");
  if (endMs - startMs < durationMinutes * 60_000)
    throw new Error("Leave enough time for at least one full session.");
  if (endMs - startMs > 24 * 60 * 60_000)
    throw new Error("Add availability in windows of 24 hours or less.");
  return { startsAt, endsAt };
}

export function formatMiamiDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MIAMI_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}
