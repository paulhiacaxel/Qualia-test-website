import { z } from "zod";

const optionalMinutes = (minimum: number) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) return null;
      if (typeof value === "number") return value;
      return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
    },
    z
      .number()
      .int("Use whole minutes.")
      .min(minimum, `Use at least ${minimum} minutes.`)
      .max(10080, "Use at most 10,080 minutes (7 days).")
      .nullable(),
  );

export const bookingPolicySchema = z.object({
  enabled: z.boolean(),
  request_expiry_minutes: z.number().int().min(1).max(10080).nullable(),
  payment_deadline_minutes: z.number().int().min(1).max(10080).nullable(),
});
export type BookingPolicy = z.infer<typeof bookingPolicySchema>;

export const bookingPolicyInputSchema = z
  .object({
    enabled: z.boolean(),
    requestExpiryMinutes: optionalMinutes(1),
    // Keep the read schema permissive for historical settings, but never save a
    // new window shorter than hosted Checkout can open (31 min + handoff margin).
    paymentDeadlineMinutes: optionalMinutes(32),
  })
  .superRefine((value, context) => {
    if (
      value.enabled &&
      (value.requestExpiryMinutes === null || value.paymentDeadlineMinutes === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["enabled"],
        message: "Choose both deadlines before enabling booking requests.",
      });
    }
  });
