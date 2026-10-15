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
        "Bring your own camera for a photography walk in Brickell with Eduardo Bono. Start with a 15-minute introduction, spend 45 minutes making photographs, then sit down for a 30-minute review of 15–20 images each. Talk about what caught your attention, what you felt and how your choices appear in the photographs.\n\nExplore Brickell through your own lens, paying attention to light, architecture and city scenes. Eduardo will help you notice a different angle and find the details that interest you. The exact route, meeting point and dates will be confirmed before bookings open.\n\nUse your own camera; tell Eduardo what you plan to bring. The selected images are from his existing portfolio. They are not identified as photographs of Brickell and do not show this new session. Final equipment requirements, walking conditions and weather arrangements will be confirmed before publication.",
      category: "photography",
      price_cents: 30000,
      duration_minutes: 90,
      city: "Miami",
      neighborhood: "Brickell",
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
