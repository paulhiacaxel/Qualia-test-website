import { z } from "zod";

export const environmentSchema = z.enum(["sandbox", "live"]);

// Decimal strings avoid rounding a percentage before it becomes basis points.
const percentage = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage with at most two decimal places.")
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  })
  .pipe(z.number().int().min(0).max(10000));
const integer = (max: number) =>
  z
    .string()
    .regex(/^\d+$/, "Enter a whole number, including zero when intended.")
    .transform(Number)
    .pipe(z.number().int().min(0).max(max));
const explicitBoolean = z.enum(["yes", "no"]).transform((value) => value === "yes");

export const commercialInputSchema = z
  .object({
    environment: environmentSchema,
    enabled: z.boolean(),
    standard_fee_bps: percentage,
    founder_fee_bps: percentage,
    processing_allocation: z.enum(["platform_absorbs", "host_actual_cost"]),
    payout_delay_hours: integer(720),
    restore_refunded_credit: explicitBoolean,
    referral_free_bookings: integer(10),
    referral_credit_cap: integer(100),
    terms_version: z.string().trim().min(1).max(100),
    cancellation_terms: z.string().trim().min(10).max(10000),
    incentive_start: z.literal("host_enrollment"),
    cutoff_rule: z.literal("checkout_before_cutoff_frozen_quote"),
    refund_rule: z.literal("proportional_commission_nonrefundable_processing"),
    completion_rule: z.literal("admin_after_end"),
    liability_acknowledged: z.literal(true),
  })
  .superRefine((value, context) => {
    if (value.founder_fee_bps > value.standard_fee_bps)
      context.addIssue({
        code: "custom",
        path: ["founder_fee_bps"],
        message: "The founding rate cannot exceed the standard rate.",
      });
    if (value.referral_free_bookings > value.referral_credit_cap)
      context.addIssue({
        code: "custom",
        path: ["referral_credit_cap"],
        message: "The referral cap must cover at least one referral grant.",
      });
  });

export const commercialPolicySchema = z.object({
  enabled: z.boolean(),
  policy: z
    .object({
      id: z.uuid(),
      environment: environmentSchema,
      standard_fee_bps: z.number().int(),
      founder_fee_bps: z.number().int(),
      processing_allocation: z.enum(["platform_absorbs", "host_actual_cost"]),
      payout_delay_hours: z.number().int(),
      restore_refunded_credit: z.boolean(),
      referral_free_bookings: z.number().int(),
      referral_credit_cap: z.number().int(),
      terms_version: z.string(),
      cancellation_terms: z.string(),
    })
    .nullable(),
});
export type CommercialPolicy = z.infer<typeof commercialPolicySchema>;
