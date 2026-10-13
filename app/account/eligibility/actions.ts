"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/validation";
import type { AuthState } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { ADULT_ATTESTATION_VERSION } from "@/lib/participation/types";

export async function confirmAdultAccount(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  await requireUser("/account/eligibility");
  if (formData.get("adultConfirmed") !== "on")
    return { error: "Confirm that you are 18 or older and this is your own account." };
  try {
    const supabase = await createClient();
    // Only this explicit, verified, signed-in action records the adult attestation.
    const { error } = await supabase.rpc("attest_adult_account", {
      p_is_adult: true,
      p_version: ADULT_ATTESTATION_VERSION,
    });
    if (error) return { error: "Your confirmation could not be saved. Please try again." };
  } catch {
    return { error: "Your confirmation could not be saved. Please try again." };
  }
  revalidatePath("/", "layout");
  const next = safeNext(formData.get("next"));
  const destination = next.startsWith("/account/eligibility") ? "/account/dashboard" : next;
  const scope = destination.startsWith("/host/") ? "host" : "guest";
  redirect(`/account/agreements?scope=${scope}&next=${encodeURIComponent(destination)}`);
}
