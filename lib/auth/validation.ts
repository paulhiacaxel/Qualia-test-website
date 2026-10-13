import { z } from "zod";

const email = z
  .string()
  .trim()
  .max(254)
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use 128 characters or fewer.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});
export const signupSchema = z.object({
  email,
  password,
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(100, "Use 100 characters or fewer."),
  role: z.enum(["guest", "host"]),
  adultConfirmed: z.literal("on", { error: "You must be 18 or older to create a Qualia account." }),
});
export const emailSchema = z.object({ email });
export const passwordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The passwords do not match.",
    path: ["confirmPassword"],
  });

/** Restrict post-auth navigation to known app destinations, never supplied origins. */
export function safeNext(value: unknown, fallback = "/account/dashboard"): string {
  if (typeof value !== "string" || value.length > 200) return fallback;
  // Eligibility can retain a known destination, but never another nested redirect.
  if (value.startsWith("/account/eligibility?next=")) {
    try {
      const destination = decodeURIComponent(value.slice("/account/eligibility?next=".length));
      if (
        destination.startsWith("/account/eligibility") ||
        destination.startsWith("/account/agreements")
      )
        return fallback;
      const next = safeNext(destination, "");
      return next ? `/account/eligibility?next=${encodeURIComponent(next)}` : fallback;
    } catch {
      return fallback;
    }
  }
  if (value.startsWith("/account/agreements?")) {
    const match = value.match(/^\/account\/agreements\?scope=(guest|host)&next=([^&]+)$/);
    if (!match) return fallback;
    try {
      const destination = decodeURIComponent(match[2]);
      if (
        destination.startsWith("/account/agreements") ||
        destination.startsWith("/account/eligibility")
      )
        return fallback;
      const next = safeNext(destination, "");
      return next
        ? `/account/agreements?scope=${match[1]}&next=${encodeURIComponent(next)}`
        : fallback;
    } catch {
      return fallback;
    }
  }
  const destinations = new Set([
    "/account/dashboard",
    "/account/eligibility",
    "/account/agreements",
    "/host/start",
    "/host/dashboard",
    "/admin",
    "/account/update-password",
    "/discover",
    "/contact",
    "/bookings",
    "/host/calendar",
    "/host/profile",
    "/account/profile",
    "/host/listings/new",
  ]);
  const detail = value.match(/^\/(?:experiences|bookings)\/([^/]+)$/);
  if (detail && z.uuid().safeParse(detail[1]).success) return value;
  return destinations.has(value) ? value : fallback;
}

export function eligibilityPath(value: unknown): string {
  const next = safeNext(value);
  return next.startsWith("/account/eligibility")
    ? next
    : `/account/eligibility?next=${encodeURIComponent(next)}`;
}

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
