// Lightweight options shared by forms and server validation. Keeping these out of
// validation.ts avoids shipping the time-zone polyfill with the listing form.
export const categories = [
  "cooking",
  "sailing",
  "photography",
  "language",
  "music",
  "art",
  "fitness",
] as const;
export const cities = ["Miami", "Miami Beach"] as const;
export const bookingFormats = ["private", "shared", "both"] as const;
export const privatePriceBases = ["group", "per_guest"] as const;
export const resourceKinds = [
  "boat",
  "captain",
  "instructor",
  "space",
  "equipment",
  "other",
] as const;
export const MAX_LISTING_GUESTS = 50;
