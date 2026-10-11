import { z } from "zod";
import { operationSchema } from "./contracts";

const state = z.string();
const operationSummary = z.object({
  operation_id: z.string(),
  kind: z.string(),
  state,
  amount_cents: z.number(),
  reversed_total_cents: z.number().optional(),
});
const payout = z.object({
  payout_id: z.string(),
  state,
  amount_cents: z.number(),
  currency: z.string(),
  arrival_date: z.string().nullable().optional(),
});
const payment = z.object({
  state,
  amount_cents: z.number(),
  commission_cents: z.number(),
  processor_fee_cents: z.number().nullable(),
  processing_allocation: z.string(),
  currency: z.string(),
});
export const hostPaymentsSchema = z.object({
  commercial: z
    .object({
      enabled: z.boolean(),
      terms_version: z.string(),
      standard_fee_bps: z.number(),
      founder_fee_bps: z.number(),
      processing_allocation: z.string(),
      payout_delay_hours: z.number(),
      cancellation_terms: z.string(),
      founder: z
        .object({ lifetime_fee_bps: z.number(), starts_at: z.string(), ends_at: z.string() })
        .nullable(),
      founder_credits_consumed: z.number(),
      founder_credits_reserved: z.number(),
      referral_credits_granted: z.number(),
      referral_credits_used: z.number(),
    })
    .nullable(),
  account: z
    .object({
      transfers_active: z.boolean(),
      payouts_active: z.boolean(),
      synced_at: z.string().nullable().optional(),
    })
    .nullable(),
  earnings: z.array(
    z.object({
      booking_id: z.string(),
      booking_status: z.string(),
      payment: payment.nullable(),
      operations: z.array(operationSummary),
    }),
  ),
  payouts: z.array(payout),
});
export const adminPaymentsSchema = z.object({
  attempts: z.array(
    z.object({
      id: z.string(),
      booking_id: z.string(),
      state,
      amount_cents: z.number(),
      currency: z.string(),
      session_id: z.string().nullable(),
      booking_status: z.string(),
      booking_ends_at: z.string(),
      quarantine_reason: z.string().nullable().optional(),
    }),
  ),
  operations: z.array(operationSchema),
  disputes: z.array(z.object({ dispute_id: z.string(), state, amount_cents: z.number() })),
  payouts: z.array(payout),
});
