import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { categories, cities, idSchema } from "@/lib/host/validation";
import type { HostProfile, ListingPhoto } from "@/lib/host/types";
import type {
  BookingDetails,
  BookingPolicy,
  BookingSlot,
  BookingSummary,
  PublicExperience,
} from "./types";
import { calendarDay, calendarMonth, miamiDateKey } from "./validation";

export async function listExperiences({
  category,
  city,
  limit = 60,
  hostId,
}: { category?: string; city?: string; limit?: number; hostId?: string } = {}) {
  if (!getSupabaseConfig()) return { configured: false, experiences: [] as PublicExperience[] };
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (category && categories.includes(category as (typeof categories)[number]))
    query = query.eq("category", category);
  if (city && cities.includes(city as (typeof cities)[number])) query = query.eq("city", city);
  if (hostId) query = query.eq("host_id", hostId);
  const { data, error } = await query;
  if (error) throw new Error("Experiences could not be loaded. Please try again.");
  const experiences = (data ?? []) as PublicExperience[];
  if (!experiences.length) return { configured: true, experiences };
  const [photosResult, hostsResult] = await Promise.all([
    supabase
      .from("listing_photos")
      .select("listing_id,storage_path,alt_text,position")
      .in(
        "listing_id",
        experiences.map((experience) => experience.id),
      )
      .order("position"),
    supabase
      .from("host_profiles")
      .select("user_id,display_name,bio,city,portfolio_url")
      .in("user_id", [...new Set(experiences.map((experience) => experience.host_id))]),
  ]);
  if (photosResult.error || hostsResult.error)
    throw new Error("Experience details could not be loaded.");
  const covers = experiences
    .map((experience) => photosResult.data?.find((photo) => photo.listing_id === experience.id))
    .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));
  const signed = covers.length
    ? await supabase.storage.from("listing-photos").createSignedUrls(
        covers.map((photo) => photo.storage_path),
        1200,
      )
    : null;
  if (signed?.error) throw new Error("Experience photos could not be loaded.");
  for (const experience of experiences) {
    const cover = covers.find((photo) => photo.listing_id === experience.id);
    experience.coverUrl =
      signed?.data?.find((photo) => photo.path === cover?.storage_path)?.signedUrl ?? undefined;
    experience.coverAlt = cover?.alt_text;
    experience.host = hostsResult.data?.find((host) => host.user_id === experience.host_id) as
      HostProfile | undefined;
  }
  return { configured: true, experiences };
}

export async function getPublicExperience(id: string) {
  if (!idSchema.safeParse(id).success || !getSupabaseConfig()) notFound();
  const supabase = await createClient();
  // Always filter published, even when the caller happens to be the owner/admin.
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("This experience could not be loaded.");
  if (!data) notFound();
  const [hostResult, photosResult] = await Promise.all([
    supabase
      .from("host_profiles")
      .select("user_id,display_name,bio,city,portfolio_url")
      .eq("user_id", data.host_id)
      .single(),
    supabase
      .from("listing_photos")
      .select("id,listing_id,storage_path,alt_text,position")
      .eq("listing_id", id)
      .order("position"),
  ]);
  if (hostResult.error || photosResult.error)
    throw new Error("This experience could not be loaded.");
  const photos = photosResult.data as ListingPhoto[];
  if (photos.length) {
    const { data: signed, error: signError } = await supabase.storage
      .from("listing-photos")
      .createSignedUrls(
        photos.map((photo) => photo.storage_path),
        1200,
      );
    if (signError) throw new Error("Experience photos could not be loaded.");
    for (const photo of photos)
      photo.signedUrl =
        signed?.find((result) => result.path === photo.storage_path)?.signedUrl ?? undefined;
  }
  return { listing: data as PublicExperience, host: hostResult.data as HostProfile, photos };
}

export async function getPublicHost(id: string) {
  if (!idSchema.safeParse(id).success) notFound();
  const { experiences } = await listExperiences({ hostId: id });
  // A host without a published listing has no public profile yet.
  if (!experiences.length || !experiences[0].host) notFound();
  return { host: experiences[0].host, experiences };
}

export async function getSlots(id: string, month?: string, requestedDate?: string) {
  const calendar = calendarMonth(month);
  const supabase = await createClient();
  const [windows, policy] = await Promise.all([
    supabase
      .from("availability_windows")
      .select("starts_at,ends_at")
      .eq("listing_id", id)
      .lt("starts_at", calendar.until)
      .gt("ends_at", calendar.from),
    supabase.rpc("get_booking_policy"),
  ]);
  if (windows.error || policy.error)
    throw new Error("Availability could not be loaded. Please try again.");
  const today = miamiDateKey(new Date().toISOString());
  const scheduledDates: string[] = [];
  for (let index = 1; index <= calendar.days; index++) {
    const date = `${calendar.value}-${String(index).padStart(2, "0")}`;
    if (date < today) continue;
    const bounds = calendarDay(date);
    if (
      windows.data?.some(
        (window) =>
          Date.parse(window.starts_at) < Date.parse(bounds.until) &&
          Date.parse(window.ends_at) > Date.parse(bounds.from),
      )
    )
      scheduledDates.push(date);
  }
  const validRequestedDate =
    requestedDate && scheduledDates.includes(requestedDate) ? requestedDate : null;
  const selectedDate =
    validRequestedDate ??
    scheduledDates[0] ??
    (today.startsWith(calendar.value) ? today : `${calendar.value}-01`);
  const bounds = calendarDay(selectedDate);
  // A one-day query stays below the 2,000-slot safety cap even for one-minute
  // experiences, so later dates never disappear because a month was truncated.
  const slots = await supabase.rpc("list_booking_slots", {
    p_listing_id: id,
    p_from: bounds.from,
    p_until: bounds.until,
  });
  if (slots.error) throw new Error("Available times could not be loaded. Please try again.");
  return {
    calendar: { ...calendar, selectedDate, scheduledDates },
    slots: (slots.data ?? []) as BookingSlot[],
    policy: policy.data as BookingPolicy,
  };
}

export async function getMyBookings(role: "guest" | "host") {
  await requireUser(role === "host" ? "/host/calendar" : "/bookings");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_bookings", { p_role: role });
  if (error) throw new Error("Your bookings could not be loaded.");
  return (data ?? []) as BookingSummary[];
}

export async function getBookingDetails(id: string) {
  const user = await requireUser(`/bookings/${id}`);
  if (!idSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_details", { p_booking_id: id });
  if (error || !data) notFound();
  const details = data as BookingDetails;
  // Explicit participant restriction keeps admin oversight separate from user chat.
  if (![details.booking.guest_id, details.booking.host_id].includes(user.id)) notFound();
  return { ...details, userId: user.id };
}
