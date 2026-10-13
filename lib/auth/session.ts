import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "./validation";
import type { AccountEligibility } from "@/lib/participation/types";
import type { LegalAcceptanceStatus, LegalScope } from "@/lib/legal/types";

export const getCurrentUser = cache(async () => {
  if (!getSupabaseConfig()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return null;
    return data.user;
  } catch {
    // A failed verification cannot grant access, even during an auth outage.
    return null;
  }
});

export async function requireUser(next = "/account/dashboard") {
  if (!getSupabaseConfig()) redirect("/auth/unavailable");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  if (!user.email_confirmed_at) redirect("/verify-email");
  return user;
}

export const getAccountEligibility = cache(async (): Promise<AccountEligibility | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_account_eligibility");
  if (error || !data)
    throw new Error("Your account eligibility could not be checked. Please try again.");
  return data as AccountEligibility;
});

/** Gate new participation without blocking existing receipts, refunds or recovery. */
export async function requireAdultAccount(next = "/account/dashboard") {
  const user = await requireUser(next);
  const eligibility = await getAccountEligibility();
  if (!eligibility?.eligible) {
    redirect(`/account/eligibility?next=${encodeURIComponent(safeNext(next))}`);
  }
  await requireLegalAgreement(next.startsWith("/host/") ? "host" : "guest", next);
  return user;
}

export const getLegalAcceptance = cache(async (): Promise<LegalAcceptanceStatus> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_legal_acceptance");
  if (error || !data)
    throw new Error("Your agreement record could not be checked. Please try again.");
  return data as LegalAcceptanceStatus;
});

/** New activity is gated; browsing, receipts, cancellations and recovery stay available. */
export async function requireLegalAgreement(scope: LegalScope, next = "/account/dashboard") {
  await requireUser(next);
  const accepted = await getLegalAcceptance();
  if (!(scope === "host" ? accepted.host_accepted : accepted.guest_accepted)) {
    const destination = safeNext(next);
    redirect(`/account/agreements?scope=${scope}&next=${encodeURIComponent(destination)}`);
  }
}

export const getProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, is_host, created_at")
    .eq("id", user.id)
    .single();
  if (error || !data)
    throw new Error("Your account profile could not be loaded. Please try again.");
  return data as {
    id: string;
    full_name: string;
    avatar_url: string | null;
    is_host: boolean;
    created_at: string;
  };
});

export async function requireHost() {
  const user = await requireUser("/host/dashboard");
  const profile = await getProfile();
  if (!profile?.is_host) redirect("/host/start");
  return { user, profile };
}

/** New host work requires eligibility; existing records and declines remain accessible. */
export async function requireAdultHost() {
  await requireAdultAccount("/host/dashboard");
  return requireHost();
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) redirect("/account/dashboard");
  return user;
}
