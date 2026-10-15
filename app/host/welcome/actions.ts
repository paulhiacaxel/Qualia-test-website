"use server";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdultAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAssistedHostListing } from "@/lib/host/assisted/data";
import { assistedHost } from "@/lib/host/assisted/catalog";
import { assistedConfirmationSchema } from "@/lib/host/assisted/validation";
import type { HostActionState } from "@/lib/host/types";

export async function claimPreparedListing(
  _state: HostActionState,
  form: FormData,
): Promise<HostActionState> {
  const user = await requireAdultAccount("/host/welcome");
  const setup = await getAssistedHostListing();
  const prepared = assistedHost(setup?.source_key);
  if (!setup || !prepared) return { error: "No prepared listing is attached to this account." };
  const parsed = assistedConfirmationSchema.safeParse(Object.fromEntries(form));
  if (!setup.confirmed_at && !parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createClient();
  if (!setup.confirmed_at && parsed.success) {
    const { error } = await db.rpc("confirm_assisted_host_listing", {
      p_price_cents: parsed.data.price,
      p_pricing_mode: parsed.data.pricingMode,
      p_max_guests: parsed.data.maxGuests,
      p_copy_approved: true,
    });
    if (error)
      return {
        error:
          "Your confirmation could not be saved. Please check your account setup and try again.",
      };
  }
  // Copy curated local assets using the HOST'S own storage session, so ordinary
  // ownership and publication checks remain intact. No service-role impersonation.
  try {
    const { data: existing, error: readError } = await db
      .from("listing_photos")
      .select("storage_path,position")
      .eq("listing_id", setup.listing_id);
    if (readError) throw new Error("photo_read_failed");
    const paths = new Set((existing ?? []).map((p) => p.storage_path as string));
    let position = Math.max(-1, ...(existing ?? []).map((p) => Number(p.position))) + 1;
    for (const photo of prepared.photos) {
      const hash = createHash("sha256")
        .update(`${setup.source_key}/${photo.src}`)
        .digest("hex")
        .slice(0, 32);
      const objectId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
      const path = `${user.id}/${setup.listing_id}/${objectId}.webp`;
      if (paths.has(path)) continue;
      // Source paths come only from the server registry, never form input or email.
      const bytes = await readFile(join(process.cwd(), "public", photo.src));
      const { error: uploadError } = await db.storage
        .from("listing-photos")
        .upload(path, bytes, { contentType: "image/webp", upsert: false });
      if (
        uploadError &&
        !["409", "Duplicate"].includes(String(uploadError.statusCode ?? uploadError.name))
      )
        throw new Error("photo_upload_failed");
      const { error: registerError } = await db.rpc("add_listing_photo", {
        p_listing_id: setup.listing_id,
        p_storage_path: path,
        p_alt_text: photo.alt,
        p_position: position,
      });
      if (registerError) throw new Error("photo_register_failed");
      position += 1;
    }
  } catch {
    revalidatePath("/host/welcome");
    return {
      error:
        "Your listing details are saved. Some photos still need copying; press Continue to finish again. Your existing photos will be kept.",
    };
  }
  revalidatePath("/host/dashboard");
  revalidatePath("/host/welcome");
  redirect(`/host/listings/${setup.listing_id}/edit`);
}
