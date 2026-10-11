"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireHost, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canEditListing, getOwnedListing } from "@/lib/host/data";
import {
  accountProfileSchema,
  hostProfileSchema,
  idSchema,
  listingSchema,
  locationSchema,
  validateAvailability,
} from "@/lib/host/validation";
import type { HostActionState } from "@/lib/host/types";

const connectionError = {
  error: "We could not save that right now. Please try again in a moment.",
};

function refreshListing(id: string) {
  revalidatePath("/host/dashboard");
  revalidatePath("/host/calendar");
  revalidatePath("/discover");
  revalidatePath(`/experiences/${id}`);
  revalidatePath(`/host/listings/${id}/edit`);
  revalidatePath(`/host/listings/${id}/preview`);
}

function listingId(formData: FormData) {
  return idSchema.safeParse(formData.get("listingId"));
}

export async function saveAccountProfile(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const user = await requireUser();
  const parsed = accountProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.fullName })
      .eq("id", user.id)
      .select("id")
      .single();
    if (error || !data) return connectionError;
  } catch {
    return connectionError;
  }
  revalidatePath("/account/dashboard");
  revalidatePath("/account/profile");
  return { success: "Your name has been updated." };
}

export async function saveHostProfile(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const parsed = hostProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { displayName, bio, city, portfolioUrl } = parsed.data;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_host_profile", {
      p_display_name: displayName,
      p_bio: bio,
      p_city: city,
      p_portfolio_url: portfolioUrl || null,
    });
    if (error)
      return {
        error:
          "Your host profile could not be saved. Profiles are locked while an experience is under review, approved, published, or paused.",
      };
  } catch {
    return connectionError;
  }
  revalidatePath("/host/profile");
  revalidatePath("/host/dashboard");
  return { success: "Your host profile is saved. You can create an experience now." };
}

function listingArguments(value: z.output<typeof listingSchema>) {
  return {
    p_title: value.title,
    p_description: value.description,
    p_category: value.category,
    p_price_cents: value.price,
    p_duration_minutes: value.durationMinutes,
    p_city: value.city,
    p_neighborhood: value.neighborhood,
  };
}

export async function createListing(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const parsed = listingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let id: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_listing", listingArguments(parsed.data));
    if (error || !idSchema.safeParse(data).success)
      return {
        error:
          "We could not create the draft. Make sure your host profile is saved, then try again.",
      };
    id = data as string;
  } catch {
    return connectionError;
  }
  revalidatePath("/host/dashboard");
  redirect(`/host/listings/${id}/edit?created=1`);
}

export async function saveListing(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const id = listingId(formData);
  const parsed = listingSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "This experience could not be found." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_listing", {
      p_listing_id: id.data,
      ...listingArguments(parsed.data),
    });
    if (error)
      return {
        error:
          "This draft could not be saved. Listings are locked while they are under review or published.",
      };
  } catch {
    return connectionError;
  }
  refreshListing(id.data);
  return { success: "Your experience details are saved." };
}

export async function saveLocation(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const id = listingId(formData);
  const parsed = locationSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "This experience could not be found." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { addressLine1, addressLine2, postalCode, meetingInstructions } = parsed.data;
    const { error } = await supabase.rpc("save_listing_location", {
      p_listing_id: id.data,
      p_address_line1: addressLine1,
      p_address_line2: addressLine2,
      p_postal_code: postalCode,
      p_meeting_instructions: meetingInstructions,
    });
    if (error) return connectionError;
  } catch {
    return connectionError;
  }
  refreshListing(id.data);
  return { success: "Your private meeting details are saved." };
}

export async function uploadPhoto(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const { user } = await requireHost();
  const id = listingId(formData);
  if (!id.success) return { error: "This experience could not be found." };
  const listing = await getOwnedListing(id.data);
  if (!canEditListing(listing))
    return { error: "Photos cannot be changed while a listing is in review or published." };
  const file = formData.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Choose a JPEG, PNG, or WebP photo." };
  if (file.size > 3 * 1024 * 1024)
    return {
      error: "Choose a photo smaller than 3 MB. You can export a smaller copy from your photo app.",
    };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return { error: "Only JPEG, PNG, and WebP photos are supported." };
  const alt = z
    .string()
    .trim()
    .min(3, "Add a short description of this photo.")
    .max(250)
    .safeParse(formData.get("altText"));
  if (!alt.success) return { error: alt.error.issues[0].message };

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("listing_photos")
    .select("position")
    .eq("listing_id", id.data)
    .order("position", { ascending: false });
  if (readError) return connectionError;
  if ((existing?.length ?? 0) >= 8)
    return { error: "You can add up to eight photos. Remove one before adding another." };
  let output: Buffer;
  try {
    // Inspect decoded content instead of trusting the extension or browser MIME.
    // Sharp's default output strips EXIF/GPS; rotate applies orientation first.
    const source = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40_000_000,
      failOn: "error",
    });
    const metadata = await source.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    )
      return { error: "Use a still JPEG, PNG, or WebP photo." };
    if ((metadata.width ?? 0) < 320 || (metadata.height ?? 0) < 240)
      return { error: "Choose a photo at least 320 × 240 pixels." };
    output = await source
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    return { error: "This photo could not be read. Export a fresh JPEG or PNG and try again." };
  }
  const path = `${user.id}/${id.data}/${randomUUID()}.webp`;
  try {
    const { error: uploadError } = await supabase.storage
      .from("listing-photos")
      .upload(path, output, { contentType: "image/webp", upsert: false });
    if (uploadError) return { error: "Your photo could not be uploaded. Please try again." };
    const { error } = await supabase.rpc("add_listing_photo", {
      p_listing_id: id.data,
      p_storage_path: path,
      p_alt_text: alt.data,
      p_position: (existing?.[0]?.position ?? -1) + 1,
    });
    if (error) {
      await supabase.storage.from("listing-photos").remove([path]);
      return { error: "Your photo could not be added. Refresh the page and try again." };
    }
  } catch {
    return connectionError;
  }
  refreshListing(id.data);
  return { success: "Your photo has been added." };
}

export async function removePhoto(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const id = listingId(formData);
  const photoId = idSchema.safeParse(formData.get("photoId"));
  if (!id.success || !photoId.success) return { error: "This photo could not be found." };
  const listing = await getOwnedListing(id.data);
  if (!canEditListing(listing))
    return { error: "Photos cannot be changed while a listing is in review or published." };
  try {
    const supabase = await createClient();
    const { data: photo, error: readError } = await supabase
      .from("listing_photos")
      .select("storage_path")
      .eq("id", photoId.data)
      .eq("listing_id", id.data)
      .single();
    if (readError || !photo) return { error: "This photo could not be found." };
    // Remove the object first: concurrent submission refuses dangling metadata,
    // so a listing cannot enter review while its last photo is being removed.
    const { error: storageError } = await supabase.storage
      .from("listing-photos")
      .remove([photo.storage_path]);
    if (storageError) return { error: "The photo could not be removed. Please try again." };
    const { error } = await supabase.rpc("remove_listing_photo", { p_photo_id: photoId.data });
    if (error)
      return {
        error:
          "The image file was removed, but the photo record could not be cleared. Please retry removal.",
      };
  } catch {
    return connectionError;
  }
  refreshListing(id.data);
  return { success: "Photo removed." };
}

export async function addAvailability(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const id = listingId(formData);
  if (!id.success) return { error: "This experience could not be found." };
  const listing = await getOwnedListing(id.data);
  let window: { startsAt: string; endsAt: string };
  try {
    window = validateAvailability(
      String(formData.get("startsAt") ?? ""),
      String(formData.get("endsAt") ?? ""),
      listing.duration_minutes,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Choose a valid time window." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_availability_window", {
      p_listing_id: id.data,
      p_starts_at: window.startsAt,
      p_ends_at: window.endsAt,
    });
    if (error)
      return {
        error:
          "This availability could not be added. Check for overlapping windows and that the listing is still editable.",
      };
  } catch {
    return connectionError;
  }
  refreshListing(id.data);
  return { success: "Your availability is saved in Miami time." };
}

export async function removeAvailability(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const id = listingId(formData);
  const windowId = idSchema.safeParse(formData.get("windowId"));
  if (!id.success || !windowId.success) return { error: "This availability could not be found." };
  await getOwnedListing(id.data);
  try {
    const supabase = await createClient();
    const { data, error: readError } = await supabase
      .from("availability_windows")
      .select("id")
      .eq("id", windowId.data)
      .eq("listing_id", id.data)
      .single();
    if (readError || !data) return { error: "This availability could not be found." };
    const { error } = await supabase.rpc("remove_availability_window", {
      p_window_id: windowId.data,
    });
    if (error)
      return {
        error: "This availability cannot be removed. It may be locked by review or a booking.",
      };
  } catch {
    return connectionError;
  }
  refreshListing(id.data);
  return { success: "Availability removed." };
}

export async function submitListing(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireHost();
  const id = listingId(formData);
  if (!id.success) return { error: "This experience could not be found." };
  if (formData.get("reviewConfirmed") !== "on")
    return { error: "Confirm that the listing is accurate and ready for review." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_listing_for_review", { p_listing_id: id.data });
    if (error)
      return {
        error:
          "We could not submit this listing. Complete your host bio, description, neighborhood, meeting address, photos, and future availability, then try again.",
      };
  } catch {
    return connectionError;
  }
  refreshListing(id.data);
  redirect(`/host/listings/${id.data}/edit?submitted=1`);
}

export async function deleteListing(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const { user } = await requireHost();
  const id = listingId(formData);
  if (!id.success) return { error: "This experience could not be found." };
  if (formData.get("deleteConfirmed") !== "on")
    return { error: "Confirm that you want to permanently delete this draft." };
  const listing = await getOwnedListing(id.data);
  if (listing.status !== "draft" || listing.submitted_at)
    return { error: "Only a draft that has never been submitted can be deleted." };
  try {
    const supabase = await createClient();
    const prefix = `${user.id}/${id.data}`;
    const { data: files, error: listError } = await supabase.storage
      .from("listing-photos")
      .list(prefix, { limit: 100 });
    if (listError) return connectionError;
    if (files?.length) {
      const { error } = await supabase.storage
        .from("listing-photos")
        .remove(files.map((file) => `${prefix}/${file.name}`));
      if (error) return { error: "We could not remove this draft’s photos. Please try again." };
    }
    const { error } = await supabase.rpc("delete_listing", { p_listing_id: id.data });
    if (error) return { error: "The draft could not be deleted. Refresh the page and try again." };
  } catch {
    return connectionError;
  }
  revalidatePath("/host/dashboard");
  redirect("/host/dashboard");
}
