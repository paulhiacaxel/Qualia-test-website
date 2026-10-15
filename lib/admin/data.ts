import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { ReviewDetail, ReviewListing } from "./types";

export const queueStatuses = [
  "pending",
  "submitted",
  "in_review",
  "approved",
  "published",
  "paused",
  "rejected",
] as const;
export type QueueStatus = (typeof queueStatuses)[number];

export async function getReviewQueue(status: QueueStatus, page: number) {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("id,host_id,title,category,status,safety_status,consultation_status,submitted_at", {
      count: "exact",
    });
  query =
    status === "pending"
      ? query.in("status", ["submitted", "in_review", "approved"])
      : query.eq("status", status);
  const { data, count, error } = await query
    .order("submitted_at", { ascending: true })
    .range((page - 1) * 30, page * 30 - 1);
  if (error) throw new Error("The review queue could not be loaded.");
  return { listings: (data ?? []) as ReviewListing[], total: count ?? 0 };
}

export async function getListingReview(id: string): Promise<ReviewDetail | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_listing_review", { p_listing_id: id });
  if (error?.code === "P0002") return null;
  if (error || !data) throw new Error("This review could not be loaded.");
  const review = data as ReviewDetail;
  if (review.photos.length) {
    const { data: signed, error: signingError } = await supabase.storage
      .from("listing-photos")
      .createSignedUrls(
        review.photos.map((photo) => photo.storage_path),
        300,
      );
    const urls = new Map((signed ?? []).map((photo) => [photo.path, photo.signedUrl]));
    review.photos = review.photos.map((photo) => ({
      ...photo,
      signedUrl: urls.get(photo.storage_path) ?? undefined,
    }));
    review.photoError = Boolean(signingError || review.photos.some((photo) => !photo.signedUrl));
  }
  return review;
}
