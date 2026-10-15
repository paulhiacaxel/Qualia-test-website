// An editorial proposal for the artist to review, not a published listing or inventory.
// Image provenance and publication requirements are recorded in docs/mlk-preview.md.
export const mlkProposal = {
  host: "Kyle Holbrook",
  organization: "Moving Lives of Kids",
  websiteUrl: "https://www.mlkmural.com/",
  experienceUrl: "https://www.mlkmural.com/experiences",
  feedbackUrl:
    "mailto:contact@bookqualia.com?subject=MLK%20Mural%20%E2%80%94%20listing%20preview%20feedback",
  photos: {
    hero: {
      src: "/previews/mlk-mural/hero.webp",
      alt: "Rayos Del Sol, a large colorful mural by Kyle Holbrook on a building in Little Havana, Miami",
      width: 1400,
      height: 932,
    },
    process: {
      src: "/previews/mlk-mural/process.webp",
      alt: "Kyle Holbrook working with a brush on a colorful mural, photographed by Kirsten Creative",
      width: 850,
      height: 1275,
    },
    artist: {
      src: "/previews/mlk-mural/artist.webp",
      alt: "Portrait of Kyle Holbrook, executive artist at Moving Lives of Kids, by Kirsten Creative",
      width: 500,
      height: 592,
    },
    miami: {
      src: "/previews/mlk-mural/miami.webp",
      alt: "Kyle Holbrook with the Americares group beside their colorful mural, May 2024",
      width: 1200,
      height: 900,
    },
    detail: {
      src: "/previews/mlk-mural/detail.webp",
      alt: "Bacardi participants with the Los Suenos mural in a past MLK Mural painting experience",
      width: 850,
      height: 1132,
    },
  },
} as const;
