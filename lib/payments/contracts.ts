import { z } from "zod";

const cents = z.number().int().nonnegative().max(99999999);
const environment = z.enum(["sandbox", "live"]);
export const accountReservationSchema = z.object({
  operation_id: z.uuid(),
  host_id: z.uuid(),
  environment,
  account_id: z.string().nullable(),
  created_at: z.string(),
});
export const checkoutReservationSchema = z.object({
  attempt_id: z.uuid(),
  operation_id: z.uuid(),
  booking_id: z.uuid(),
  guest_id: z.uuid(),
  host_id: z.uuid(),
  listing_title: z.string(),
  // Absent on pre-group bookings so existing Checkout attempts replay unchanged.
  booking_mode: z.enum(["private", "shared"]).optional(),
  party_size: z.number().int().min(1).max(50).optional(),
  price_basis_snapshot: z.enum(["group", "per_guest"]).optional(),
  unit_price_cents_snapshot: cents.positive().optional(),
  amount_cents: cents.positive(),
  currency: z.literal("usd"),
  host_account_id: z.string(),
  commission_cents: cents,
  expires_at: z.string(),
  created_at: z.string(),
  attempt_state: z.string(),
  session_id: z.string().nullable(),
  url: z.string().nullable(),
});
export const operationSchema = z.object({
  operation_id: z.uuid(),
  kind: z.enum(["transfer", "refund", "reversal"]),
  state: z.enum(["queued", "pending", "succeeded", "failed", "unknown"]),
  environment,
  created_at: z.string(),
  amount_cents: cents.positive(),
  currency: z.literal("usd").optional(),
  booking_id: z.uuid().optional(),
  external_id: z.string().nullable().optional(),
  destination: z.string().optional(),
  charge_id: z.string().nullable().optional(),
  payment_intent_id: z.string().nullable().optional(),
  transfer_id: z.string().nullable().optional(),
  transfer_group: z.string().optional(),
  reversal_operation: z.unknown().nullable().optional(),
});
export type PaymentOperation = z.infer<typeof operationSchema>;
export type PaymentActionState = { error?: string; success?: string };

export const checkoutTermsSchema = z.object({
  amount_cents: cents.positive(),
  currency: z.literal("usd"),
  policy_id: z.uuid(),
  terms_version: z.string(),
  cancellation_terms: z.string(),
  booking_status: z.string(),
  starts_at: z.string(),
  payment_deadline_at: z.string().nullable(),
  checkout_state: z.string().nullable(),
  checkout_session_exists: z.boolean(),
  checkout_expires_at: z.string().nullable(),
});
export type CheckoutTerms = z.infer<typeof checkoutTermsSchema>;
export type CheckoutTermsState = PaymentActionState & { terms?: CheckoutTerms };
