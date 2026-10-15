/** Person-written fallbacks. Glory can replace each via the page's Search and sharing CMS fields. */

export const HOUSE_NAME = "Prudential Atelier";

/** Other names people search for the house by. */
export const HOUSE_ALT_NAMES = ["Prudent Gabriel", "Prudential Atelier Lagos", "Prudential Bride", "Prudential Kids"] as const;

export const HOUSE_FOUNDER = "Prudent Gabriel-Okopi";

/** One paragraph a search engine or AI assistant can quote about the house. */
export const HOUSE_DESCRIPTION =
  "Prudent Gabriel (Prudential Atelier) is a Nigerian luxury fashion house in Lagos, founded by Mrs. Prudent Gabriel-Okopi. " +
  "It makes women's ready-to-wear, bespoke couture, bridal gowns and children's occasion wear, each piece made to order " +
  "in its Ajah, Lagos atelier in 7–12 days and delivered across Nigeria and worldwide.";

/** Topics the house is an authority on: schema.org knowsAbout and store keywords. */
export const HOUSE_KNOWS_ABOUT = [
  "Ready-to-wear in Lagos",
  "Nigerian fashion",
  "Luxury fashion brand in Nigeria",
  "Women's dresses",
  "Evening gowns",
  "Owambe and occasion dresses",
  "Asoebi styles",
  "Bespoke couture",
  "Made-to-measure tailoring",
  "Bridal gowns and wedding dresses",
  "Children's occasion wear",
] as const;

export type PageSeoFallback = {
  title: string;
  description: string;
};

export const PAGE_SEO_FALLBACKS: Record<string, PageSeoFallback> = {
  home: {
    title: "Prudent Gabriel — Luxury Nigerian Fashion Brand in Lagos",
    description:
      "Prudent Gabriel is a Lagos fashion house: women's ready-to-wear, bespoke couture and bridal gowns by Mrs. Prudent Gabriel-Okopi. Made to order in 7–12 days, shipped across Nigeria and worldwide.",
  },
  shop: {
    title: "Shop Nigerian Designer Clothing Online — Prudent Gabriel",
    description:
      "Shop women's dresses, bridal, kids and accessories from a Lagos fashion brand. Every Prudent Gabriel piece is made to order in 7–12 days and delivered across Nigeria and worldwide.",
  },
  rtw: {
    title: "Ready-to-Wear in Lagos — Women's Dresses by Prudent Gabriel",
    description:
      "Ready-to-wear from a Lagos fashion brand: evening gowns, owambe and occasion dresses, workwear and everyday pieces. Made to order in 7–12 days, delivered across Nigeria and worldwide.",
  },
  atelier: {
    title: "Bespoke Couture in Lagos — Made to Measure by Prudent Gabriel",
    description:
      "Bespoke and made-to-measure couture in Lagos. Every commission starts with a conversation with Prudent Gabriel and is cut and fitted at the atelier in Ajah.",
  },
  bridal: {
    title: "Wedding Dresses in Lagos — Bridal Gowns by Prudent Gabriel",
    description:
      "Bridal gowns, reception dresses and traditional wedding looks from Prudential Bride in Lagos. Made to order, fitted in Ajah, worn by brides across Nigeria and the world.",
  },
  kids: {
    title: "Kids' Occasion Wear in Lagos — Prudential Kids by Prudent Gabriel",
    description:
      "Children's party, owambe and occasion outfits from Prudential Kids, cut in the same Lagos atelier as the Prudent Gabriel women's house. Made to order, shipped worldwide.",
  },
  collections: {
    title: "Collections — Nigerian Fashion Edits by Prudent Gabriel",
    description:
      "Ready-to-wear edits from the Prudent Gabriel atelier in Lagos, each with its own mood, silhouette and story.",
  },
  journal: {
    title: "The Journal — Nigerian Fashion and Style Notes from Lagos",
    description:
      "Styling notes, work from the beading room and the making of a Lagos fashion house. From Prudent Gabriel, for the women who wear it.",
  },
  about: {
    title: "About Prudent Gabriel — Nigerian Fashion Designer in Lagos",
    description:
      "Prudent Gabriel is a Lagos fashion house founded by Mrs. Prudent Gabriel-Okopi: ready-to-wear, couture and bridal, made to order and finished by hand in Ajah.",
  },
  contact: {
    title: "Contact Prudent Gabriel — Fashion Atelier in Ajah, Lagos",
    description:
      "Visit the Prudent Gabriel atelier at No. 4 Akinwale Shitu Divine Homes, Thomas Estates, Ajah, Lagos. Book a fitting, ask about an order or send a note.",
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
  faqs: {
    title: "FAQs — Ordering, Sizing, Delivery & Bespoke | Prudent Gabriel",
    description:
      "Answers from the Prudent Gabriel atelier in Lagos: made-to-order timings, sizes and made to measure, payment in naira, dollars or pounds, delivery, returns, bespoke and bridal commissions.",
  },
  careers: {
    title: "Careers at Prudential Atelier — join the Lagos house",
    description:
      "Open roles in the atelier, the workroom and Prudent Gabriel. Pattern, beading, bridal and the floor that ships it.",
  },
  consultation: {
    title: "Book a Fashion Design Consultation in Lagos — Prudent Gabriel",
    description:
      "Sit with Mrs. Prudent Gabriel-Okopi or the creative team, in Ajah, Lagos or on a call, and begin a bespoke dress, bridal gown or made-to-measure commission.",
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

export type FaqItem = { question: string; answer: string };

/**
 * Questions people put to Google and AI assistants, answered on the page.
 * Each answer must stay true to how the house works; FAQPage JSON-LD repeats them.
 */
export const HOME_FAQ: FaqItem[] = [
  {
    question: "What is Prudent Gabriel?",
    answer:
      "Prudent Gabriel, also known as Prudential Atelier, is a Nigerian luxury fashion brand based in Lagos. Founded by Mrs. Prudent Gabriel-Okopi, the house makes women's ready-to-wear, bespoke couture, bridal gowns and children's occasion wear.",
  },
  {
    question: "Where is the Prudent Gabriel atelier in Lagos?",
    answer:
      "The atelier is at No. 4 Akinwale Shitu Divine Homes, Thomas Estates, Ajah, Lagos, Nigeria. You can book a consultation to visit, or sit with the team on a call.",
  },
  {
    question: "Does Prudent Gabriel sell ready-to-wear in Lagos?",
    answer:
      "Yes. The ready-to-wear line includes evening gowns, owambe and occasion dresses, workwear and everyday pieces, all cut in the Lagos atelier. Order online and choose delivery in Lagos, anywhere in Nigeria or abroad.",
  },
  {
    question: "How long does an order take?",
    answer:
      "Every piece is made to order after you buy it. Ready-to-wear is made in 7–12 days, then shipped. Bespoke and bridal commissions follow their own timeline, agreed at your consultation.",
  },
  {
    question: "Can I get a dress made to my measurements?",
    answer:
      "Yes. Most ready-to-wear pieces can be made to measure from the measurements you enter on the product page, and the atelier takes full bespoke commissions, from first sketch to final fitting.",
  },
  {
    question: "Does Prudent Gabriel make wedding dresses?",
    answer:
      "Yes. Prudential Bride designs bridal gowns, reception dresses and traditional wedding looks in Lagos, made to order and fitted for brides in Nigeria and around the world.",
  },
  {
    question: "Do you ship outside Nigeria?",
    answer:
      "Yes. Prudent Gabriel ships worldwide, and prices can be shown in naira, US dollars or pounds. Delivery within Lagos and across Nigeria is also available.",
  },
];

export const RTW_FAQ: FaqItem[] = [
  {
    question: "Where can I buy ready-to-wear in Lagos?",
    answer:
      "Prudent Gabriel's ready-to-wear is sold here online and made in the house's atelier in Ajah, Lagos. Pick your size, or have the piece made to your measurements, and choose delivery in Lagos, across Nigeria or worldwide.",
  },
  {
    question: "What kind of ready-to-wear does Prudent Gabriel make?",
    answer:
      "Evening gowns, owambe and party dresses, occasion and wedding-guest looks, workwear and everyday pieces for women, in standard sizes or made to your measurements.",
  },
  {
    question: "How long does ready-to-wear take to arrive?",
    answer:
      "Each piece is made to order in 7–12 days, then shipped. Delivery time depends on where you are, and is shown at checkout.",
  },
  {
    question: "What if my size is between two sizes?",
    answer:
      "Take the larger size, or choose made to measure and enter your measurements so the piece is cut to fit you. The size guide on each product shows bust, waist, hip and length.",
  },
];
