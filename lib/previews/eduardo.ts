// Editorial review page only. This data is deliberately separate from listings,
// availability and checkout. Published reference terms require Eduardo's approval
// before they can become a Qualia offer; the teaching idea is only a proposal.
export const eduardoProposal = {
  name: "Eduardo Bono",
  portfolioUrl: "https://www.krop.com/ecoloco/",
  serviceUrl: "https://www.airbnb.com/services/6105236",
  checkedAt: "October 13, 2026",
  packageName: "Basic Brickell",
  durationHours: 1,
  pricePerGuestDollars: 50,
  minimumDollars: 200,
  editedPhotos: 40,
  deliveryHours: 48,
  headshot: {
    src: "/previews/eduardo-bono/headshot.webp",
    width: 240,
    height: 240,
    alt: "Eduardo Bono, wearing glasses and a beanie, in his published profile photo.",
  },
  editUrl: `mailto:contact@bookqualia.com?subject=${encodeURIComponent("Eduardo Bono — thoughts on my Qualia preview")}&body=${encodeURIComponent("Hi Qualia,\n\nI had a look at the preview. Here are my thoughts:\n\n")}`,
  photos: {
    hero: {
      src: "/previews/eduardo-bono/hero.webp",
      width: 1200,
      height: 800,
      alt: "A graduate jumps with an electric guitar in Eduardo Bono's celebratory portrait.",
    },
    portrait: {
      src: "/previews/eduardo-bono/portrait.webp",
      width: 850,
      height: 1079,
      alt: "A person surrounded by sunlit sunflowers in a portrait by Eduardo Bono.",
    },
    light: {
      src: "/previews/eduardo-bono/light.webp",
      width: 850,
      height: 478,
      alt: "A black-and-white portrait of a smiling man at a bar, by Eduardo Bono.",
    },
    moment: {
      src: "/previews/eduardo-bono/moment.webp",
      width: 850,
      height: 478,
      alt: "Five people jumping on a green hill beneath a wide blue sky, photographed by Eduardo Bono.",
    },
    place: {
      src: "/previews/eduardo-bono/place.webp",
      width: 850,
      height: 567,
      alt: "A golden sun low over the water with paddlers in silhouette, photographed by Eduardo Bono.",
    },
  },
} as const;
