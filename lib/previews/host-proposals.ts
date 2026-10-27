type PreviewPhoto = { src: string; alt: string; width: number; height: number; caption: string };
type Detail = { label: string; value: string };
export type HostProposal = {
  tone: "mosaic" | "sushi";
  hostFirstName: string;
  hostName: string;
  brand: string;
  websiteUrl: string;
  aboutUrl: string;
  eyebrow: string;
  title: string;
  titleEmphasis: string;
  heroIntro: string;
  photos: { hero: PreviewPhoto; detail: PreviewPhoto; host: PreviewPhoto } | null;
  facts: Detail[];
  storyEyebrow: string;
  storyTitle: string;
  storyLead: string;
  storyBody: string;
  flowTitle: string;
  steps: { title: string; body: string }[];
  cardTitle: string;
  details: Detail[];
  detailNote: string;
  hostEyebrow: string;
  hostTitle: string;
  hostParagraphs: string[];
  reviewIntro: string;
  confirmationDetails: string;
  sourceNote: string;
  sources: { label: string; href: string }[];
};

export const violitaMosaic: HostProposal = {
  tone: "mosaic",
  hostFirstName: "Pamela",
  hostName: "Pamela Canestrini",
  brand: "Violita",
  websiteUrl: "https://violita.it/",
  aboutUrl: "https://violita.it/about/",
  eyebrow: "Mosaic art · Little Haiti, Miami",
  title: "Small pieces.",
  titleEmphasis: "Something entirely yours.",
  heroIntro:
    "A hands-on introduction to mosaic with Pamela: choose your colors, learn the tools and begin a piece of your own.",
  photos: {
    hero: {
      src: "/previews/violita/mosaic-class.jpg",
      alt: "Hands arranging small colorful mosaic tiles on a wooden board at a Violita workshop",
      width: 1800,
      height: 1800,
      caption: "At the worktable · A past Violita mosaic class",
    },
    detail: {
      src: "/previews/violita/mosaic-detail.jpg",
      alt: "A close view of green tiles and reflective pieces in a Violita mosaic",
      width: 1800,
      height: 1800,
      caption: "Color, texture, and the spaces between · Violita’s work",
    },
    host: {
      src: "/previews/violita/pamela.avif",
      alt: "Pamela Canestrini at her mosaic workbench, pictured on Violita’s artist page",
      width: 800,
      height: 800,
      caption: "Pamela at her workbench · Image from Violita",
    },
  },
  facts: [
    { label: "The craft", value: "Mosaic, piece by piece" },
    { label: "The starting point", value: "Beginner-friendly" },
    { label: "The setting", value: "Violita · Little Haiti" },
  ],
  storyEyebrow: "An afternoon at the worktable",
  storyTitle: "Find a color you like. Give it a place.",
  storyLead:
    "A mosaic starts with a handful of small decisions: a shape, a color, one piece beside another.",
  storyBody:
    "At Violita’s Little Haiti studio, get to know the tools, explore a simple pattern and begin building it on a wooden board with Pamela’s guidance. No previous mosaic experience is needed.",
  flowTitle: "From loose pieces to a pattern.",
  steps: [
    {
      title: "Meet the materials.",
      body: "Get familiar with the board, colored tesserae, glue and mosaic tools. Learn how to handle the tools and prepare your materials with Pamela.",
    },
    {
      title: "Choose a direction.",
      body: "Explore a simple design, try a few color combinations and work out where the pieces might go.",
    },
    {
      title: "Begin your mosaic.",
      body: "Arrange and attach pieces with guidance. Violita recommends two 3-hour classes to finish its 12 × 12-inch project; finishing and take-home timing need Pamela’s confirmation.",
    },
  ],
  cardTitle: "Your first mosaic, one piece at a time.",
  details: [
    { label: "Host", value: "Pamela · Violita" },
    { label: "Class reference", value: "3 hours" },
    { label: "Project reference", value: "12 × 12-inch mosaic" },
    { label: "Setting", value: "Little Haiti studio, proposed" },
    { label: "Price & group size", value: "To confirm with Pamela" },
    { label: "Dates", value: "To be agreed" },
  ],
  detailNote:
    "Violita’s website lists Mosaic Basics at $150 and recommends two 3-hour classes to finish. The price basis, second-session cost, materials, group format and final Qualia offer are not yet confirmed.",
  hostEyebrow: "Meet the artist · Violita",
  hostTitle: "A mosaic practice, from Ravenna to Miami.",
  hostParagraphs: [
    "Pamela studied archaeology and mosaic art in Ravenna before opening her Mosaique workshop in Desenzano in 2005. In 2023, she opened Violita in Miami’s Little Haiti Art & Design District.",
    "This page proposes a personal introduction to her craft, grounded in the Mosaic Basics class she already teaches. The project, pace and format remain hers to choose.",
  ],
  reviewIntro:
    "Pamela, this is a starting point built around Mosaic Basics and your own studio images. Change the title, project or format—tell us what feels right for Violita.",
  confirmationDetails:
    "Confirm the price and what it covers, one- or two-session format, guest limit, materials, ages, studio details and dates.",
  sourceNote:
    "The class length, project size and $150 reference come from Violita’s public Mosaic Basics page, checked October 27, 2026. Its recommendation of two classes is preserved here. The suggested session flow is editorial copy for Pamela’s review; completion in one class is not promised.",
  sources: [
    { label: "Mosaic Basics", href: "https://violita.it/product/mosaic-basics/" },
    { label: "About Pamela & Violita", href: "https://violita.it/about/" },
  ],
};

export const micasShackSushi: HostProposal = {
  tone: "sushi",
  hostFirstName: "Mica",
  hostName: "Mica",
  brand: "Mica’s Shack",
  websiteUrl: "https://www.micasshack.com/",
  aboutUrl: "https://www.micasshack.com/private-chef-miami",
  eyebrow: "Sushi making · Your Miami kitchen",
  title: "Roll, shape,",
  titleEmphasis: "and share.",
  heroIntro:
    "A private sushi class with Mica. Learn the rice, make maki and nigiri, then sit down together to eat what you’ve made.",
  photos: null,
  facts: [
    { label: "The format", value: "Private, hands-on class" },
    { label: "The skills", value: "Rice · Maki · Nigiri" },
    { label: "The setting", value: "Your home or venue" },
  ],
  storyEyebrow: "Bring your people into the kitchen",
  storyTitle: "Make dinner part of the occasion.",
  storyLead:
    "Gather around the counter, get your hands into the process and make the sushi you’ll share at the table.",
  storyBody:
    "Work with Mica on sushi rice, fish preparation, maki and nigiri in your Miami home or venue. Shape the menu around your group and kitchen, then share what you’ve made.",
  flowTitle: "A little practice. Then dinner.",
  steps: [
    {
      title: "Start with the rice.",
      body: "Begin with the foundation of your sushi. Mica guides the group through the rice before the rolling and shaping begin.",
    },
    {
      title: "Prepare, roll and shape.",
      body: "Work on fish preparation, make maki rolls and practice shaping nigiri with Mica beside you.",
    },
    {
      title: "Bring it to the table.",
      body: "Sit down with your group and enjoy what you’ve made. The class itself becomes part of the meal.",
    },
  ],
  cardTitle: "Your kitchen. Your group. Sushi with Mica.",
  details: [
    { label: "Host", value: "Mica · Mica’s Shack" },
    { label: "Format", value: "Private cooking class" },
    { label: "Location", value: "Your Miami home or venue" },
    { label: "Price", value: "Quoted for the group & menu" },
    { label: "Duration & guest limit", value: "To confirm with Mica" },
    { label: "Dates", value: "To be agreed" },
  ],
  detailNote:
    "The exact menu, ingredients, equipment, kitchen requirements, travel area and any extra charges need confirmation. Share allergies and whether anyone avoids raw fish; any menu adjustments or ingredient-handling arrangements must be agreed before booking.",
  hostEyebrow: "Meet the chef · Mica’s Shack",
  hostTitle: "A chef at your counter, a meal made together.",
  hostParagraphs: [
    "Mica is the chef and founder behind Mica’s Shack. Her Miami offerings bring private dining and hands-on cooking into people’s homes and venues, from sushi to plant-based cooking and Argentine parrilla.",
    "For this proposed class, the focus is on making sushi together. Tell Mica about your group and kitchen so she can shape a practical format and menu.",
  ],
  reviewIntro:
    "Mica, we’ve built this first look around your existing sushi class. We’ll add the photographs you choose and approve. If another menu or format is a better starting point, we can reshape the page around it.",
  confirmationDetails:
    "Confirm the menu, duration, price basis, guest limit, ingredients and tools, kitchen needs, dietary arrangements, available dates and your preferred class photos.",
  sourceNote:
    "The class content and home-or-venue setting come from Mica’s Shack’s cooking-classes page, checked October 27, 2026. No fixed public class price, duration or capacity was found. No host photographs are used in this first draft; the image area is reserved for photos Mica chooses and approves.",
  sources: [
    { label: "Mica’s cooking classes", href: "https://www.micasshack.com/cooking-classes-miami" },
    { label: "Mica’s sushi work", href: "https://www.micasshack.com/sushi-chef-miami" },
    { label: "About the chef", href: "https://www.micasshack.com/private-chef-miami" },
    { label: "Website credits", href: "https://www.micasshack.com/credits" },
  ],
};
