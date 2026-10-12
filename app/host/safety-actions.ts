"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdultHost } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { safetySubmissionSchema } from "@/lib/participation/validation";
import type { HostActionState } from "@/lib/host/types";

export type SafetySaveState = HostActionState & { savedRevision?: number };

function failedSave(previous: SafetySaveState, error: string): SafetySaveState {
  return { error, savedRevision: previous.savedRevision };
}

const saveContextSchema = z.object({
  listingId: z.uuid(),
  expectedRevision: z.number().int().positive().nullable(),
});

export async function saveListingSafety(
  previous: SafetySaveState,
  formData: FormData,
): Promise<SafetySaveState> {
  await requireAdultHost();
  const revision = formData.get("expectedRevision");
  const context = saveContextSchema.safeParse({
    listingId: formData.get("listingId"),
    expectedRevision: revision ? Number(revision) : null,
  });
  if (!context.success)
    return failedSave(previous, "Reload this experience before saving your safety details.");
  const parsed = safetySubmissionSchema.safeParse({
    ...Object.fromEntries(
      Object.keys(safetySubmissionSchema.shape).map((key) => [key, formData.get(key)]),
    ),
    min_age: formData.get("min_age") ? Number(formData.get("min_age")) : null,
    max_age: formData.get("max_age") ? Number(formData.get("max_age")) : null,
    guardian_presence: formData.get("guardian_presence") || null,
    evidence_expires_on: formData.get("evidence_expires_on") || null,
  });
  if (!parsed.success) return failedSave(previous, parsed.error.issues[0].message);
  let savedRevision: number;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_listing_safety_submission", {
      p_listing_id: context.data.listingId,
      p_expected_revision: context.data.expectedRevision,
      p_submission: parsed.data,
    });
    if (error) {
      if (["22023", "55000", "40001"].includes(error.code))
        return failedSave(previous, error.message);
      return failedSave(
        previous,
        "Your participation and safety details could not be saved. Please try again.",
      );
    }
    if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 1)
      return failedSave(
        previous,
        "The saved version could not be confirmed. Reload the experience before making more changes.",
      );
    savedRevision = data;
  } catch {
    return failedSave(
      previous,
      "We could not connect. Your changes are still in this form; try saving again.",
    );
  }
  const id = context.data.listingId;
  revalidatePath(`/host/listings/${id}/edit`);
  revalidatePath(`/host/listings/${id}/preview`);
  revalidatePath("/host/dashboard");
  revalidatePath(`/admin/listings/${id}`);
  revalidatePath("/admin");
  revalidatePath(`/experiences/${id}`);
  revalidatePath("/discover");
  return {
    savedRevision,
    success:
      "Participation and safety draft saved. Qualia reviews this version separately before publication.",
  };
}
