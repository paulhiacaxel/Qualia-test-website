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
  const destinations = new Set([
    "/account/dashboard",
    "/host/start",
    "/host/dashboard",
    "/admin",
    "/account/update-password",
    "/discover",
  ]);
  return destinations.has(value) ? value : fallback;
}

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
