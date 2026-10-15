import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hostPaymentAccess } from "./config";

/** Request-scoped verification also protects service callers and stale forms.
 * Sandbox access is for verified administrators only; public hosts never enter it. */
export const getHostPaymentAccess = cache(async (hostId: string) => {
  const user = await getCurrentUser();
  if (!user || user.id !== hostId || !user.email_confirmed_at) return null;
  return hostPaymentAccess(process.env, async () => {
    const client = await createClient();
    const { data, error } = await client.rpc("is_admin");
    return !error && data === true;
  });
});
