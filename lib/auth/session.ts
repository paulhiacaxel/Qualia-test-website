import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "./validation";

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

export async function requireAdmin() {
  const user = await requireUser("/admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) redirect("/account/dashboard");
  return user;
}
