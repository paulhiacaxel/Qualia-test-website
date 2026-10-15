// Display-only proposal, deliberately separate from listings and booking data.
// Published club facts were checked on October 13, 2026. CGSC must approve the
// copy, photography, instructor, price and operating details before publication.
export const cgscProposal = {
  title: "Private Keelboat Coaching on Biscayne Bay",
  programUrl: "https://www.cgscic.org/programs/adult-sailing",
  clubUrl: "https://www.cgsc.org/",
  checkedAt: "October 13, 2026",
  durationHours: 3,
  hourlyRateDollars: 80,
  neighborhood: "Coconut Grove",
  address: "2990 S Bayshore Drive, Miami, FL 33133",
  editUrl: `mailto:contact@bookqualia.com?subject=${encodeURIComponent("CGSC listing preview — suggested edits")}&body=${encodeURIComponent("Hi Qualia,\n\nHere are my comments on the private keelboat coaching preview:\n\n")}`,
  photos: [
    {
      src: "/previews/cgsc/keelboat.webp",
      width: 989,
      height: 659,
      alt: "Sailors aboard a keelboat in Coconut Grove Sailing Club’s adult sailing program photo.",
      caption: "Out on the bay",
    },
    {
      src: "/previews/cgsc/onboard.webp",
      width: 1000,
      height: 750,
      alt: "Three sailors wearing life jackets aboard a CGSC keelboat.",
      caption: "On the water with CGSC",
    },
    {
      src: "/previews/cgsc/moorings.webp",
      width: 1600,
      height: 900,
      alt: "Sailboats at Coconut Grove Sailing Club’s moorings in evening light.",
      caption: "The Coconut Grove waterfront",
    },
  ],
  coordinator: {
    name: "Ed Benitez",
    role: "Keelboat Instructor and Lead Coordinator",
    photo: "/previews/cgsc/ed-benitez.webp",
  },
} as const;

export const cgscReferencePrice = cgscProposal.durationHours * cgscProposal.hourlyRateDollars;
