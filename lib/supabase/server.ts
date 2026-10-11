import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

/** A new client per request prevents cross-user session leakage on warm servers. */
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase connection is not configured.");
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy refreshes them first;
          // Server Actions and Route Handlers can persist them normally.
        }
      },
    },
  });
}
