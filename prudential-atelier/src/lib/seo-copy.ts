/** Person-written fallbacks. Glory can replace each via the page's Search and sharing CMS fields. */

export const HOUSE_NAME = "Prudential Atelier";

export type PageSeoFallback = {
  title: string;
  description: string;
};

export const PAGE_SEO_FALLBACKS: Record<string, PageSeoFallback> = {
  home: {
    title: "Prudential Atelier — couture and ready-to-wear, made to order in Lagos",
    description:
      "Bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Cut in Lagos, made to order in 7–12 days, shipped worldwide.",
  },
  shop: {
    title: "Shop the house — ready-to-wear, bridal and kids from Prudential Atelier",
    description:
      "Everything the house sells: ready-to-wear, bridal, kids and accessories. Made to order in Lagos in 7–12 days.",
  },
  rtw: {
    title: "Ready-to-wear from Prudential Atelier — cut in Lagos, made to order",
    description:
      "Evening, formal and everyday pieces from the Lagos atelier. Each garment is made to order and leaves in 7–12 days.",
  },
  atelier: {
    title: "The Atelier — a private commission with Prudent Gabriel in Lagos",
    description:
      "Every commission begins with a conversation. Bespoke couture designed around you at the Prudential Atelier in Ajah, Lagos.",
  },
  bridal: {
    title: "Prudential Bride — gowns for the day itself, made in Lagos",
    description:
      "Bridal commissions and ceremony pieces from Prudential Atelier. Made to order, fitted in Lagos, worn around the world.",
  },
  kids: {
    title: "Prudential Kids — occasion wear for the smallest of the house",
    description:
      "Occasion and everyday pieces for children, cut in the same Lagos atelier as the women's house.",
  },
  collections: {
    title: "Collections — house edits from Prudential Atelier",
    description:
      "Curated ready-to-wear edits from the Lagos atelier, each with its own mood, silhouette and story.",
  },
  journal: {
    title: "The Journal — stories from the Prudential Atelier",
    description:
      "Styling notes, work from the beading room, and the making of a Lagos house. Written for the women who wear it.",
  },
  about: {
    title: "The house of Prudent Gabriel — a Lagos atelier",
    description:
      "Founded in Lagos by Mrs. Prudent Gabriel-Okopi. Couture and ready-to-wear made to order, finished by hand.",
  },
  contact: {
    title: "Visit or write — Prudential Atelier in Ajah, Lagos",
    description:
      "The atelier is at No. 4 Akinwale Shitu Divine Homes, Thomas Estates, Ajah. Book a sitting or send a note.",
  },
  "our-story": {
    title: "Our story — from the first stitch in Lagos",
    description:
      "How Prudent Gabriel built a house in Lagos that now dresses women across the world, one commission at a time.",
  },
  press: {
    title: "Press — Prudential Atelier in the papers",
    description:
      "Selected coverage of Prudent Gabriel and the Lagos atelier — from Vanguard Allure to the houses that sit with us.",
  },
  "size-guide": {
    title: "Size guide — how Prudential Atelier fits",
    description:
      "Women's, bridal and kids measurements, plus how we cut a custom piece. Made to order in Lagos in 7–12 days.",
  },
  careers: {
    title: "Careers at Prudential Atelier — join the Lagos house",
    description:
      "Open roles in the atelier, the workroom and the house. Pattern, beading, bridal and the floor that ships it.",
  },
  consultation: {
    title: "Book a consultation at the Lagos atelier",
    description:
      "Sit with Mrs. Prudent Gabriel-Okopi or the creative team — in Ajah or on a call — and begin a commission.",
  },
  privacy: {
    title: "Privacy Policy · Prudential Atelier",
    description: "How Prudential Atelier collects, uses and protects your personal information.",
  },
  terms: {
    title: "Terms & Conditions · Prudential Atelier",
    description: "Terms for using prudentgabriel.com and commissioning work from the Lagos atelier.",
  },
  cookie: {
    title: "Cookie Policy · Prudential Atelier",
    description: "The cookies this site uses to keep you signed in, hold your bag and remember your currency.",
  },
  returns: {
    title: "Returns & refunds · Prudential Atelier",
    description: "How returns, exchanges and refunds work for ready-to-wear and atelier commissions.",
  },
  shipping: {
    title: "Shipping · Prudential Atelier",
    description: "Lagos collection, Nigeria courier and worldwide dispatch. Made to order, then shipped.",
  },
};

/** CMS page id → seo field prefix and fallback. */
export const PAGE_SEO_CMS: Record<string, { prefix: string; title: string; description: string }> = {
  homepage: { prefix: "home", ...PAGE_SEO_FALLBACKS.home },
  shop: { prefix: "shop", ...PAGE_SEO_FALLBACKS.shop },
  rtw: { prefix: "rtw", ...PAGE_SEO_FALLBACKS.rtw },
  atelier: { prefix: "atelier", ...PAGE_SEO_FALLBACKS.atelier },
  bridal: { prefix: "bridal", ...PAGE_SEO_FALLBACKS.bridal },
  kids: { prefix: "kids", ...PAGE_SEO_FALLBACKS.kids },
  journal: { prefix: "journal", ...PAGE_SEO_FALLBACKS.journal },
  about: { prefix: "about", ...PAGE_SEO_FALLBACKS.about },
  contact: { prefix: "contact", ...PAGE_SEO_FALLBACKS.contact },
  "size-guide": { prefix: "size_guide", ...PAGE_SEO_FALLBACKS["size-guide"] },
  consultation: { prefix: "consultation", ...PAGE_SEO_FALLBACKS.consultation },
  collections: { prefix: "collections", ...PAGE_SEO_FALLBACKS.collections },
  "our-story": { prefix: "our_story", ...PAGE_SEO_FALLBACKS["our-story"] },
  press: { prefix: "press", ...PAGE_SEO_FALLBACKS.press },
  careers: { prefix: "careers", ...PAGE_SEO_FALLBACKS.careers },
};

export function uniqueFallbackTitles(): string[] {
  return Object.values(PAGE_SEO_FALLBACKS).map((row) => row.title);
}
