"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/validation";
import type { AuthState } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { GUEST_TERMS_VERSION, HOST_TERMS_VERSION } from "@/lib/legal/versions";

export async function acceptLegalTerms(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  await requireUser("/account/agreements");
  const scope = formData.get("scope");
  if (scope !== "guest" && scope !== "host")
    return { error: "Choose the agreement you want to review." };
  if (formData.get("termsAccepted") !== "on" || formData.get("privacyAcknowledged") !== "on")
    return {
      error:
        "Read and accept the agreements, and acknowledge the privacy notice, before continuing.",
    };
  // A stale page must not accept wording the visitor was never shown.
  if (
    formData.get("guestVersion") !== GUEST_TERMS_VERSION ||
    (scope === "host" && formData.get("hostVersion") !== HOST_TERMS_VERSION)
  )
    return { error: "The agreements changed. Refresh this page and review the current wording." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_legal_terms", {
      p_scope: scope,
      p_guest_version: GUEST_TERMS_VERSION,
      p_host_version: scope === "host" ? HOST_TERMS_VERSION : null,
      p_terms_accepted: true,
      p_privacy_acknowledged: true,
    });
    if (error)
      return {
        error:
          "Your acceptance could not be saved. Confirm your adult account eligibility and try again.",
      };
  } catch {
    return { error: "Your acceptance could not be saved. Please try again." };
  }
  revalidatePath("/", "layout");
  const next = safeNext(formData.get("next"));
  redirect(
    next.startsWith("/account/agreements") || next.startsWith("/account/eligibility")
      ? "/account/dashboard"
      : next,
  );
}
