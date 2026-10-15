import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/**
 * Financial workers and verified webhooks need a trusted database connection.
 * Callers must authenticate users before invoking commands on their behalf.
 * This key must never be imported into client components or public env values.
 */
export function createAdminClient() {
  const config = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret || secret.startsWith("sb_publishable_")) {
    throw new Error("The server database connection is not configured.");
  }
  return createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
