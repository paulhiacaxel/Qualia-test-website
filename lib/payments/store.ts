import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Only call after server authentication or verified Stripe signature checks. */
export async function paymentCommand<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error)
    throw new Error(
      "The payment ledger could not complete this operation. Refresh its status before retrying.",
    );
  return data as T;
}
