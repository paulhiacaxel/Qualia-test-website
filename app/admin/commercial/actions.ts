"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { commercialInputSchema, environmentSchema } from "@/lib/admin/commercial-validation";
import { miamiLocalToUtc } from "@/lib/host/validation";

export type CommercialState = { error?: string; success?: string };

async function command(
  name: string,
  args: Record<string, unknown>,
  success: string,
): Promise<CommercialState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(name, args);
  if (error)
    return {
      error: ["22023", "55000", "23505"].includes(error.code)
        ? error.code === "23505"
          ? "That host or referral is already enrolled. Existing lifetime terms cannot be overwritten."
          : error.message
        : "The change could not be saved. Reload and try again.",
    };
  revalidatePath("/admin/commercial");
  revalidatePath("/host/payments");
  return { success };
}

export async function saveCommercialPolicy(
  _state: CommercialState,
  form: FormData,
): Promise<CommercialState> {
  await requireAdmin();
  const values = Object.fromEntries(form.entries());
  const parsed = commercialInputSchema.safeParse({
    ...values,
    enabled: form.get("enabled") === "on",
    liability_acknowledged: form.get("liability_acknowledged") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return command(
    "admin_set_commercial_policy",
    { p_settings: parsed.data },
    "Commercial policy saved. Server configuration and verified Stripe readiness are still required before payment is available.",
  );
}

export async function disablePayments(
  _state: CommercialState,
  form: FormData,
): Promise<CommercialState> {
  await requireAdmin();
  const env = environmentSchema.safeParse(form.get("environment"));
  if (!env.success) return { error: "Choose sandbox or live." };
  return command(
    "admin_disable_payments",
    { p_environment: env.data },
    "New checkout creation is disabled. Existing payment attempts continue to reconcile.",
  );
}

export async function enrollFounder(
  _state: CommercialState,
  form: FormData,
): Promise<CommercialState> {
  await requireAdmin();
  const parsed = z
    .object({
      environment: environmentSchema,
      host_id: z.uuid(),
      started_at: z.string(),
      approved: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success)
    return {
      error:
        "Enter the verified host UUID, an agreed start time, and confirm the host's agreement.",
    };
  let startedAt: string;
  try {
    startedAt = miamiLocalToUtc(parsed.data.started_at);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Choose a valid Miami time." };
  }
  return command(
    "admin_enroll_founder",
    {
      p_host_id: parsed.data.host_id,
      p_environment: parsed.data.environment,
      p_started_at: startedAt,
    },
    "Founding terms recorded for this host. The reduced lifetime rate is locked to this enrollment.",
  );
}

export async function grantReferral(
  _state: CommercialState,
  form: FormData,
): Promise<CommercialState> {
  await requireAdmin();
  const parsed = z
    .object({
      environment: environmentSchema,
      referrer_id: z.uuid(),
      referred_host_id: z.uuid(),
      approved: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success)
    return { error: "Enter both host UUIDs and confirm the referral is qualified." };
  if (parsed.data.referrer_id === parsed.data.referred_host_id)
    return { error: "A host cannot refer themselves." };
  return command(
    "admin_grant_referral",
    {
      p_referrer_id: parsed.data.referrer_id,
      p_referred_host_id: parsed.data.referred_host_id,
      p_environment: parsed.data.environment,
    },
    "Referral credits granted under the approved policy.",
  );
}
