// Editorial review page only. This data is deliberately separate from listings,
// availability and checkout. The October 14 call shapes this proposal; price basis,
// capacity, venue access and final listing details still need Eduardo's confirmation.
export const eduardoProposal = {
  name: "Eduardo Bono",
  portfolioUrl: "https://www.krop.com/ecoloco/",
  serviceUrl: "https://www.airbnb.com/services/6105236",
  discussedAt: "October 14, 2026",
  backgroundCheckedAt: "October 13, 2026",
  proposedPriceDollars: 300,
  durationLabel: "1 hr 30 min",
  itinerary: [
    {
      title: "Before you take a photograph",
      minutes: 15,
      description:
        "Start with a conversation about your camera, what you enjoy photographing and what you hope to see. Eduardo introduces his approach before you head out together.",
    },
    {
      title: "Head out with your camera",
      minutes: 45,
      description:
        "Walk, look and make photographs with Eduardo alongside you. Pay attention to the light, try a different angle and notice what draws you into a scene.",
    },
    {
      title: "Look back at what you saw",
      minutes: 30,
      description:
        "Choose 15–20 of your photographs to look through together. Talk about what you noticed, what you felt while taking them and how those choices show up in the image.",
    },
  ],
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
