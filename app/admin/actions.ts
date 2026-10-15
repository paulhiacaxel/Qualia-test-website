"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { miamiDateTime, reviewSchema } from "@/lib/admin/validation";
import type { ReviewState } from "@/lib/admin/types";

export async function reviewListing(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  await requireAdmin();
  const parsed = reviewSchema.safeParse({
    ...Object.fromEntries(formData),
    profile: formData.get("profile") === "on",
    experience: formData.get("experience") === "on",
    location: formData.get("location") === "on",
    risks: formData.get("risks") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_review_listing", {
      p_listing_id: input.listingId,
      p_action: input.action,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_note: input.note,
      p_host_feedback: input.hostFeedback,
      p_scheduled_at:
        input.action === "schedule_consultation" ? miamiDateTime(input.scheduledLocal) : null,
      p_risk_notes: input.riskNotes,
      p_checks: {
        profile: input.profile,
        experience: input.experience,
        location: input.location,
        risks: input.risks,
      },
    });
    if (error) {
      if (["22023", "55000", "40001"].includes(error.code)) return { error: error.message };
      return { error: "The decision could not be saved. Reload the listing and try again." };
    }
  } catch {
    return { error: "We could not connect. Reload the listing before trying again." };
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/listings/${input.listingId}`);
  revalidatePath("/host/dashboard");
  revalidatePath(`/host/listings/${input.listingId}/edit`);
  revalidatePath(`/host/listings/${input.listingId}/preview`);
  revalidatePath("/discover");
  return { success: "Decision recorded. The listing status is up to date." };
}
