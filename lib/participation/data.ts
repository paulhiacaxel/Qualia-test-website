import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { BookingParticipation, ListingSafetySubmission, ParticipationRules } from "./types";

export { getAccountEligibility, requireAdultAccount } from "@/lib/auth/session";

export async function getListingSafetySubmission(
  id: string,
): Promise<ListingSafetySubmission | null> {
  await requireUser();
  const supabase = await createClient();
  // The RPC checks owner/admin access; raw evidence never enters a public query.
  const { data, error } = await supabase.rpc("get_listing_safety_submission", { p_listing_id: id });
  if (error) throw new Error("The participation and safety submission could not be loaded.");
  return data as ListingSafetySubmission | null;
}

export async function getListingParticipationRules(id: string): Promise<ParticipationRules | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_listing_participation_rules", {
    p_listing_id: id,
  });
  if (error) throw new Error("This experience's participation rules could not be loaded.");
  return data as ParticipationRules | null;
}

export async function getBookingParticipation(id: string): Promise<BookingParticipation | null> {
  await requireUser(`/bookings/${id}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_participation", { p_booking_id: id });
  if (error) throw new Error("The booking's participation record could not be loaded.");
  return data as BookingParticipation | null;
}
