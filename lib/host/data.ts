import "server-only";
import { notFound } from "next/navigation";
import { requireHost } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "./validation";
import type {
  AvailabilityWindow,
  HostProfile,
  HostResource,
  Listing,
  ListingLocation,
  ListingPhoto,
} from "./types";

export async function getHostProfile() {
  const { user } = await requireHost();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("host_profiles")
    .select("user_id,display_name,bio,city,portfolio_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Your host profile could not be loaded.");
  return data as HostProfile | null;
}

export async function getHostListings() {
  const { user } = await requireHost();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("host_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Your experiences could not be loaded.");
  return data as Listing[];
}

export async function getHostResources() {
  const { user } = await requireHost();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("host_resources")
    .select("id,host_id,label,kind,created_at,updated_at")
    .eq("host_id", user.id)
    .order("label");
  if (error) throw new Error("Your people and equipment could not be loaded.");
  return (data ?? []) as HostResource[];
}

export async function getOwnedListing(id: string) {
  const { user } = await requireHost();
  if (!idSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("host_id", user.id)
    .maybeSingle();
  if (error) throw new Error("This experience could not be loaded.");
  if (!data) notFound();
  return data as Listing;
}

export async function getListingDetails(id: string) {
  // Explicit owner check prevents this private preview becoming a public data endpoint.
  const listing = await getOwnedListing(id);
  const supabase = await createClient();
  const [locationResult, photoResult, availabilityResult, resourceResult] = await Promise.all([
    supabase.rpc("get_listing_location", { p_listing_id: id }),
    supabase
      .from("listing_photos")
      .select("id,listing_id,storage_path,alt_text,position")
      .eq("listing_id", id)
      .order("position"),
    supabase
      .from("availability_windows")
      .select("id,listing_id,starts_at,ends_at")
      .eq("listing_id", id)
      .order("starts_at"),
    supabase.rpc("get_listing_resource_ids", { p_listing_id: id }),
  ]);
  if (locationResult.error || photoResult.error || availabilityResult.error || resourceResult.error)
    throw new Error("Your experience details could not be loaded.");
  const photos = (photoResult.data ?? []) as ListingPhoto[];
  if (photos.length) {
    const { data, error } = await supabase.storage.from("listing-photos").createSignedUrls(
      photos.map((photo) => photo.storage_path),
      3600,
    );
    if (error) throw new Error("Your photos could not be loaded.");
    for (const photo of photos)
      photo.signedUrl =
        data?.find((signed) => signed.path === photo.storage_path)?.signedUrl ?? undefined;
  }
  return {
    listing,
    location: (Array.isArray(locationResult.data)
      ? locationResult.data[0]
      : locationResult.data) as ListingLocation | null,
    photos,
    availability: (availabilityResult.data ?? []) as AvailabilityWindow[],
    resourceIds: (resourceResult.data ?? []) as string[],
  };
}

export function canEditListing(listing: Pick<Listing, "status">) {
  return listing.status === "draft" || listing.status === "rejected";
}
