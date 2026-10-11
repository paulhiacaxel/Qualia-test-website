import Image from "next/image";
import { ActionForm } from "./action-form";
import { uploadPhoto, removePhoto } from "@/app/host/actions";
import type { ListingPhoto } from "@/lib/host/types";

export function PhotoManager({
  listingId,
  photos,
  editable,
}: {
  listingId: string;
  photos: ListingPhoto[];
  editable: boolean;
}) {
  return (
    <>
      <p>
        Show the setting, the craft, and what you&apos;ll do together. Use photos you own or have
        permission to use.
      </p>
      {photos.length ? (
        <div className="host-photo-grid">
          {photos.map((photo, index) => (
            <div className="host-photo" key={photo.id}>
              {photo.signedUrl ? (
                <Image
                  src={photo.signedUrl}
                  alt={photo.alt_text}
                  width={600}
                  height={450}
                  unoptimized
                />
              ) : (
                <div className="photo-unavailable">Photo unavailable</div>
              )}
              <div className="photo-caption">
                <span className="eyebrow">
                  {index === 0 ? "Cover photo" : `Photo ${index + 1}`}
                </span>
                <p>{photo.alt_text}</p>
                {editable ? (
                  <ActionForm action={removePhoto} label="Remove photo" danger>
                    <input type="hidden" name="listingId" value={listingId} />
                    <input type="hidden" name="photoId" value={photo.id} />
                  </ActionForm>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="host-empty">
          No photos yet. Add at least one before submitting your experience.
        </p>
      )}
      {editable && photos.length < 8 ? (
        <ActionForm action={uploadPhoto} label="Upload photo">
          <input type="hidden" name="listingId" value={listingId} />
          <div>
            <label htmlFor="photo" className="field-label">
              Add a photo
            </label>
            <input
              id="photo"
              name="photo"
              className="field-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              aria-describedby="photo-help"
            />
            <p className="field-hint" id="photo-help">
              JPEG, PNG, or WebP. Up to 3 MB, at least 320 × 240 pixels. Maximum eight photos.
              Export a smaller copy from your photo app if needed.
            </p>
          </div>
          <div>
            <label htmlFor="photo-description" className="field-label">
              Describe the photo
            </label>
            <input
              id="photo-description"
              name="altText"
              className="field-input"
              minLength={3}
              maxLength={250}
              required
              placeholder="For example, a ceramic bowl on the studio workbench"
            />
            <p className="field-hint">
              A short description makes your photos accessible to guests using screen readers.
            </p>
          </div>
        </ActionForm>
      ) : null}
    </>
  );
}
