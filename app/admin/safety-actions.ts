"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { miamiLocalToUtc } from "@/lib/host/validation";
import { safetyReviewSchema } from "@/lib/participation/validation";
import type { ReviewState } from "@/lib/admin/types";

export async function reviewListingSafety(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  await requireAdmin();
  let validUntil: string | null = null;
  try {
    if (formData.get("decision") === "approved" && formData.get("validUntil")) {
      validUntil = miamiLocalToUtc(String(formData.get("validUntil")));
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Choose a valid approval expiry." };
  }
  const parsed = safetyReviewSchema.safeParse({
    listingId: formData.get("listingId"),
    expectedRevision: Number(formData.get("expectedRevision")),
    decision: formData.get("decision"),
    reviewNote: formData.get("reviewNote"),
    validUntil,
    minorWithoutGuardianApproved: formData.get("minorWithoutGuardianApproved") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_review_listing_safety", {
      p_listing_id: input.listingId,
      p_expected_revision: input.expectedRevision,
      p_decision: input.decision,
      p_review_note: input.reviewNote,
      p_valid_until: input.validUntil,
      p_minor_without_guardian_approved: input.minorWithoutGuardianApproved,
    });
    if (error) {
      if (["22023", "55000", "40001"].includes(error.code)) return { error: error.message };
      return {
        error: "This participation review could not be saved. Reload the experience and try again.",
      };
    }
  } catch {
    return { error: "We could not connect. Your review notes are still in this form." };
  }
  revalidatePath(`/admin/listings/${input.listingId}`);
  revalidatePath("/admin");
  revalidatePath(`/host/listings/${input.listingId}/edit`);
  revalidatePath(`/host/listings/${input.listingId}/preview`);
  revalidatePath("/host/dashboard");
  revalidatePath(`/experiences/${input.listingId}`);
  revalidatePath("/discover");
  return {
    success:
      "Participation review recorded for this exact version. Publication remains a separate decision.",
  };
}
