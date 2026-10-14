import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/host/types";
export type AssistedListing = {
  source_key: string;
  listing_id: string;
  confirmed_at: string | null;
  listing: Listing;
};
export const getAssistedHostListing = cache(async (): Promise<AssistedListing | null> => {
  await requireUser("/host/welcome");
  const db = await createClient();
  const { data, error } = await db.rpc("get_assisted_host_listing");
  if (error) throw new Error("Your prepared listing could not be loaded.");
  return data as AssistedListing | null;
});
