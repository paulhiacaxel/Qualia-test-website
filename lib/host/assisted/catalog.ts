import "server-only";
import { eduardoProposal } from "@/lib/previews/eduardo";

/** Curated by the operator, never populated from arbitrary inbound email. */
export const assistedHostCatalog = {
  "eduardo-bono": {
    email: "ecoloco@mac.com",
    name: "Eduardo Bono",
    previewPath: "/previews/eduardo-bono",
    profile: {
      display_name: "Eduardo Bono",
      bio: "Eduardo Bono is a photographer and creative director with a background in graphic design. His work includes portraits, outdoor scenes and Grads on the Porch. In this experience, he helps guests use their own cameras and explore their own way of seeing.",
      city: "Miami",
      portfolio_url: "https://www.krop.com/ecoloco/",
    },
    listing: {
      title: "Through a photographer’s eyes with Eduardo Bono",
      description:
        "Bring your own camera for a photography walk with Eduardo Bono. Start with a 15-minute introduction, spend 45 minutes making photographs, then sit down for a 30-minute review of 15–20 images each. Talk about what caught your attention, what you felt and how your choices appear in the photographs.\n\nThe starting idea is a nature walk in Cutler Bay. Deering Estate is a possible venue, subject to access and admission confirmation. City scenes, architecture, portraits and sunrise sessions are alternative ideas to agree with Eduardo. The first location, meeting point and dates will be confirmed before bookings open.\n\nUse your own camera; tell Eduardo what you plan to bring. The selected images on this page are from his existing portfolio, not photographs of this new session. Final equipment requirements, route, weather plan and any venue charges will be confirmed before publication.",
      category: "photography",
      price_cents: 30000,
      duration_minutes: 90,
      city: "Miami",
      neighborhood: "Cutler Bay — location to confirm",
    },
    photos: [
      eduardoProposal.photos.place,
      eduardoProposal.photos.portrait,
      eduardoProposal.photos.light,
      eduardoProposal.photos.hero,
      eduardoProposal.photos.moment,
    ],
  },
} as const;
export type AssistedHostKey = keyof typeof assistedHostCatalog;
export function assistedHost(key: unknown) {
  return typeof key === "string" && Object.hasOwn(assistedHostCatalog, key)
    ? assistedHostCatalog[key as AssistedHostKey]
    : null;
}
