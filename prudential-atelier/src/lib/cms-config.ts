export type CmsFieldType =
  | "text"
  | "textarea"
  | "toggle"
  | "number"
  | "select"
  | "image"
  | "richtext"
  | "messages"
  | "links";

export type CmsField = {
  key: string;
  label: string;
  type: CmsFieldType;
  default: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  uploadFolder?: string;
};

export type CmsSection = {
  id: string;
  label: string;
  fields: CmsField[];
};

export type CmsPageDef = {
  id: string;
  label: string;
  previewPath?: string;
  sections: CmsSection[];
};

const consultationTypeFields = (prefix: string, defaults: Record<string, string>): CmsField[] => [
  { key: `${prefix}_badge`, label: "Badge label", type: "text", default: defaults.badge ?? "" },
  { key: `${prefix}_title`, label: "Title", type: "text", default: defaults.title ?? "" },
  { key: `${prefix}_description`, label: "Description", type: "textarea", default: defaults.description ?? "" },
  { key: `${prefix}_feature_1`, label: "Feature 1", type: "text", default: defaults.feature1 ?? "" },
  { key: `${prefix}_feature_2`, label: "Feature 2", type: "text", default: defaults.feature2 ?? "" },
  { key: `${prefix}_feature_3`, label: "Feature 3", type: "text", default: defaults.feature3 ?? "" },
  { key: `${prefix}_price_ngn`, label: "Price (NGN)", type: "number", default: defaults.priceNgn ?? "0" },
  { key: `${prefix}_price_usd`, label: "Price (USD)", type: "number", default: defaults.priceUsd ?? "0" },
  { key: `${prefix}_price_gbp`, label: "Price (GBP)", type: "number", default: defaults.priceGbp ?? "0" },
  { key: `${prefix}_duration`, label: "Duration", type: "text", default: defaults.duration ?? "" },
];

export const CMS_PAGES: CmsPageDef[] = [
  {
    id: "homepage",
    label: "Homepage",
    previewPath: "/",
    sections: [
      {
        id: "announcement",
        label: "Announcement Bar",
        fields: [
          { key: "announcement_bar_enabled", label: "Enabled", type: "toggle", default: "true" },
          {
            key: "announcement_bar_messages",
            label: "Messages",
            type: "messages",
            default: JSON.stringify([
              "WORLDWIDE SHIPPING · ₦ · $ · £",
              "COMPLIMENTARY STYLING CONSULTATION WITH EVERY ATELIER COMMISSION",
            ]),
          },
          {
            key: "announcement_bar_speed",
            label: "Speed",
            type: "select",
            default: "medium",
            options: [
              { value: "slow", label: "Slow" },
              { value: "medium", label: "Medium" },
              { value: "fast", label: "Fast" },
            ],
          },
        ],
      },
      {
        id: "hero",
        label: "Hero",
        fields: [
          { key: "home_hero_eyebrow", label: "Eyebrow text", type: "text", default: "PRUDENTIAL ATELIER · LAGOS" },
          { key: "home_hero_headline_1", label: "Headline line 1", type: "text", default: "Crafted for the" },
          { key: "home_hero_headline_2", label: "Headline line 2", type: "text", default: "Woman Who" },
          { key: "home_hero_headline_3", label: "Headline line 3", type: "text", default: "Commands the Room" },
          {
            key: "home_hero_subtext",
            label: "Subtext",
            type: "textarea",
            default:
              "Atelier couture and ready-to-wear — each piece conceived in our Lagos atelier and finished by hand for weddings, galas, and everyday elegance.",
          },
          { key: "home_hero_button_1_label", label: "Button 1 label", type: "text", default: "SHOP COLLECTION" },
          { key: "home_hero_button_1_link", label: "Button 1 link", type: "text", default: "/shop" },
          { key: "home_hero_button_2_label", label: "Button 2 label", type: "text", default: "BOOK CONSULTATION" },
          { key: "home_hero_button_2_link", label: "Button 2 link", type: "text", default: "/consultation" },
          { key: "home_hero_image", label: "Hero image", type: "image", default: "", uploadFolder: "prudent-gabriel/hero" },
          { key: "home_hero_stat_number", label: "Hero stat number", type: "text", default: "15+" },
          { key: "home_hero_stat_label", label: "Hero stat label", type: "text", default: "YEARS OF COUTURE" },
        ],
      },
      {
        id: "quote",
        label: "Brand Quote",
        fields: [
          {
            key: "home_quote_text",
            label: "Quote text",
            type: "textarea",
            default:
              "We don't make clothes. We make the way you'll be remembered — hand-finished, sourced with care, and designed entirely around you.",
          },
          {
            key: "home_quote_attribution",
            label: "Attribution",
            type: "text",
            default: "MRS. PRUDENT GABRIEL-OKOPI · FOUNDER & CREATIVE DIRECTOR",
          },
          { key: "home_quote_label", label: "Section label", type: "text", default: "SINCE THE FIRST STITCH" },
        ],
      },
      {
        id: "pfa",
        label: "PFA Banner",
        fields: [
          { key: "home_pfa_enabled", label: "Enabled", type: "toggle", default: "true" },
          { key: "home_pfa_eyebrow", label: "Eyebrow", type: "text", default: "PRUDENTIAL FASHION ACADEMY" },
          { key: "home_pfa_headline", label: "Headline", type: "text", default: "Learn the craft from the house" },
          {
            key: "home_pfa_body",
            label: "Body text",
            type: "textarea",
            default: "Pattern-cutting, beading and bridal couture — taught in the Lagos atelier.",
          },
          { key: "home_pfa_button_label", label: "Button label", type: "text", default: "DISCOVER PFA →" },
          { key: "home_pfa_button_link", label: "Button link", type: "text", default: "/about#academy" },
        ],
      },
      {
        id: "journey",
        label: "Bespoke Journey Section",
        fields: [
          { key: "home_journey_enabled", label: "Enabled", type: "toggle", default: "true" },
          { key: "home_journey_eyebrow", label: "Eyebrow", type: "text", default: "The Atelier Journey" },
          {
            key: "home_journey_headline",
            label: "Headline",
            type: "text",
            default: "Thirteen stages, one unforgettable piece.",
          },
          {
            key: "home_journey_body",
            label: "Body text",
            type: "textarea",
            default:
              "From the first consultation to the final fitting, every commission is documented and shared with you at each step.",
          },
          { key: "home_journey_button_label", label: "Button label", type: "text", default: "Begin Your Commission →" },
          { key: "home_journey_button_link", label: "Button link", type: "text", default: "/atelier" },
        ],
      },
    ],
  },
  {
    id: "atelier",
    label: "Atelier",
    previewPath: "/atelier",
    sections: [
      {
        id: "main",
        label: "Page Content",
        fields: [
          { key: "atelier_hero_headline", label: "Hero headline", type: "text", default: "The Atelier" },
          {
            key: "atelier_hero_subtext",
            label: "Hero subtext",
            type: "textarea",
            default: "Every commission begins with a conversation. We design entirely around you.",
          },
          { key: "atelier_hero_cta_label", label: "Hero CTA label", type: "text", default: "Begin a Commission" },
          { key: "atelier_process_headline", label: "Process section headline", type: "text", default: "The Thirteen Stages" },
          {
            key: "atelier_process_subtext",
            label: "Process section subtext",
            type: "textarea",
            default: "From consultation to delivery — every step documented and shared with you.",
          },
          { key: "atelier_gallery_label", label: "Gallery section label", type: "text", default: "FROM THE ATELIER" },
          { key: "atelier_gallery_headline", label: "Gallery section headline", type: "text", default: "Recent Commissions" },
          { key: "atelier_cta_headline", label: "Final CTA headline", type: "text", default: "Ready to begin?" },
          { key: "atelier_cta_button_label", label: "Final CTA button label", type: "text", default: "Book a Consultation" },
        ],
      },
    ],
  },
  {
    id: "bridal",
    label: "Bridal",
    previewPath: "/bridal",
    sections: [
      {
        id: "main",
        label: "Page Content",
        fields: [
          { key: "bridal_hero_headline", label: "Hero headline", type: "text", default: "Bridal." },
          {
            key: "bridal_hero_subtext",
            label: "Hero subtext",
            type: "textarea",
            default: "Every bride is a masterpiece. Every gown, a legacy.",
          },
          {
            key: "bridal_page_description",
            label: "Page description",
            type: "textarea",
            default: "Every bride is a masterpiece. Every gown, a legacy.",
          },
          { key: "bridal_gallery_label", label: "Gallery section label", type: "text", default: "PRUDENTIAL BRIDE" },
        ],
      },
    ],
  },
  {
    id: "kids",
    label: "Kids",
    previewPath: "/kids",
    sections: [
      {
        id: "main",
        label: "Page Content",
        fields: [
          { key: "kids_hero_headline", label: "Hero headline", type: "text", default: "Dressed for little royals" },
          {
            key: "kids_hero_subtext",
            label: "Hero subtext",
            type: "textarea",
            default: "Occasion wear and everyday elegance for the smallest members of the house.",
          },
          { key: "kids_hero_cta_label", label: "Hero CTA label", type: "text", default: "Shop Kids" },
          {
            key: "kids_page_description",
            label: "Page description",
            type: "textarea",
            default: "Occasion wear and everyday elegance for the smallest members of the house.",
          },
        ],
      },
    ],
  },
  {
    id: "consultation",
    label: "Consultation",
    previewPath: "/consultation",
    sections: [
      {
        id: "header",
        label: "Page Header",
        fields: [
          { key: "consultation_page_eyebrow", label: "Page eyebrow", type: "text", default: "BOOK A CONSULTATION" },
          { key: "consultation_page_title", label: "Page title", type: "text", default: "Sit with us" },
          {
            key: "consultation_page_subtitle",
            label: "Page subtitle",
            type: "textarea",
            default: "Choose your consultation type and book a private session with our atelier team.",
          },
        ],
      },
      {
        id: "type1",
        label: "Consultation Type 1 — Signature",
        fields: consultationTypeFields("consultation_type1", {
          badge: "SIGNATURE",
          title: "In-Person with Mrs. Prudent",
          description: "A private session with the Creative Director herself. The full atelier experience.",
          feature1: "Direct with the Creative Director",
          feature2: "Premium fabric library access",
          feature3: "Up to 90 minutes",
          priceNgn: "150000",
          priceUsd: "120",
          priceGbp: "95",
          duration: "Up to 90 minutes",
        }),
      },
      {
        id: "type2",
        label: "Consultation Type 2 — Design Team",
        fields: consultationTypeFields("consultation_type2", {
          badge: "IN-PERSON",
          title: "With the Design Team",
          description: "Sit with our senior designers in the Lagos atelier to shape your commission.",
          feature1: "Senior design team",
          feature2: "In-atelier fabric viewing",
          feature3: "Up to 60 minutes",
          priceNgn: "75000",
          priceUsd: "60",
          priceGbp: "48",
          duration: "Up to 60 minutes",
        }),
      },
      {
        id: "type3",
        label: "Consultation Type 3 — Virtual",
        fields: consultationTypeFields("consultation_type3", {
          badge: "VIRTUAL",
          title: "Virtual Consultation",
          description: "Meet us from anywhere — Zoom, Google Meet or WhatsApp. Link sent an hour before.",
          feature1: "Zoom · Meet · WhatsApp",
          feature2: "Screen-shared lookbook",
          feature3: "Up to 45 minutes",
          priceNgn: "50000",
          priceUsd: "40",
          priceGbp: "32",
          duration: "Up to 45 minutes",
        }),
      },
    ],
  },
  {
    id: "about",
    label: "About",
    previewPath: "/about",
    sections: [
      {
        id: "hero",
        label: "Hero",
        fields: [
          { key: "about_hero_headline", label: "Hero headline", type: "text", default: "The House of Prudent Gabriel" },
          { key: "about_hero_subtext", label: "Hero subtext", type: "text", default: "Founded in Lagos. Worn around the world." },
        ],
      },
      {
        id: "story",
        label: "Brand Story",
        fields: [
          {
            key: "about_story_body",
            label: "Brand story",
            type: "richtext",
            default:
              "<p>Founded in Lagos, Prudential Atelier crafts ready-to-wear, bridal, and made-to-measure commissions for women who expect more from what they wear. Every piece is designed and constructed in our atelier with the same precision whether it ships worldwide or is tailored to your measurements.</p>",
          },
        ],
      },
      {
        id: "founder",
        label: "Founder Quote",
        fields: [
          {
            key: "about_founder_quote",
            label: "Founder quote",
            type: "textarea",
            default: "I didn't plan to be a fashion designer. I just couldn't let a spoiled dress defeat me.",
          },
          { key: "about_founder_name", label: "Founder name", type: "text", default: "Mrs. Prudent Gabriel" },
          { key: "about_founder_title", label: "Founder title", type: "text", default: "Founder" },
        ],
      },
      {
        id: "academy",
        label: "Academy Section (PFA)",
        fields: [
          { key: "about_academy_enabled", label: "Enabled", type: "toggle", default: "true" },
          { key: "about_academy_headline", label: "Headline", type: "text", default: "Prudential Fashion Academy" },
          {
            key: "about_academy_body",
            label: "Body",
            type: "textarea",
            default: "Over 5,000 designers trained. The school behind the brand.",
          },
          { key: "about_academy_cta_label", label: "CTA label", type: "text", default: "Explore PFA →" },
          { key: "about_academy_cta_link", label: "CTA link", type: "text", default: "https://pfacademy.ng" },
        ],
      },
      {
        id: "team",
        label: "Team Section",
        fields: [
          { key: "about_team_enabled", label: "Enabled", type: "toggle", default: "false" },
          { key: "about_team_headline", label: "Section headline", type: "text", default: "Our team" },
          { key: "about_team_members", label: "Team members", type: "messages", default: "[]" },
        ],
      },
    ],
  },
  {
    id: "journal",
    label: "Journal",
    previewPath: "/journal",
    sections: [
      {
        id: "main",
        label: "Page Header",
        fields: [
          { key: "journal_page_eyebrow", label: "Page eyebrow", type: "text", default: "THE JOURNAL" },
          { key: "journal_page_title", label: "Page title", type: "text", default: "Style & Stories" },
          {
            key: "journal_page_subtitle",
            label: "Page subtitle",
            type: "text",
            default: "Stories from the atelier, styling notes, and behind-the-scenes craft.",
          },
        ],
      },
    ],
  },
  {
    id: "shop",
    label: "Shop",
    previewPath: "/shop",
    sections: [
      {
        id: "main",
        label: "Page Header",
        fields: [
          { key: "shop_page_eyebrow", label: "Page eyebrow", type: "text", default: "THE COLLECTION" },
          { key: "shop_page_title", label: "Page title", type: "text", default: "Prudent Gabriel" },
          {
            key: "shop_page_subtitle",
            label: "Page subtitle",
            type: "text",
            default: "Ready-to-wear, bridal, and atelier couture.",
          },
        ],
      },
    ],
  },
  {
    id: "rtw",
    label: "Ready-to-Wear",
    previewPath: "/rtw",
    sections: [
      {
        id: "main",
        label: "Page Header",
        fields: [
          { key: "rtw_page_eyebrow", label: "Page eyebrow", type: "text", default: "THE COLLECTION" },
          { key: "rtw_page_title", label: "Page title", type: "text", default: "Ready-to-Wear" },
          { key: "rtw_page_subtitle", label: "Page subtitle", type: "text", default: "" },
        ],
      },
    ],
  },
  {
    id: "track",
    label: "Track Order",
    previewPath: "/track",
    sections: [
      {
        id: "main",
        label: "Page Header",
        fields: [
          { key: "track_page_eyebrow", label: "Page eyebrow", type: "text", default: "ORDER TRACKING" },
          { key: "track_page_title", label: "Page title", type: "text", default: "Follow your commission" },
          {
            key: "track_page_subtitle",
            label: "Page subtitle",
            type: "text",
            default: "No login required — just your order reference.",
          },
        ],
      },
    ],
  },
  {
    id: "footer",
    label: "Footer",
    previewPath: "/",
    sections: [
      {
        id: "main",
        label: "Footer Content",
        fields: [
          {
            key: "footer_tagline",
            label: "Brand tagline",
            type: "textarea",
            default:
              "International luxury couture. Bespoke, ready-to-wear and bridal, made with love in Lagos for the world.",
          },
          {
            key: "footer_house_links",
            label: "THE HOUSE column links",
            type: "links",
            default: JSON.stringify([
              { label: "The Atelier", url: "/atelier" },
              { label: "Ready-to-Wear", url: "/rtw" },
              { label: "Bridal", url: "/bridal" },
              { label: "Kids", url: "/kids" },
              { label: "Fashion Academy", url: "/about#academy" },
              { label: "Journal", url: "/journal" },
            ]),
          },
          {
            key: "footer_client_links",
            label: "CLIENT CARE column links",
            type: "links",
            default: JSON.stringify([
              { label: "Track Your Order", url: "/track" },
              { label: "Size Guide", url: "/rtw" },
              { label: "Shipping & Returns", url: "/returns-policy" },
              { label: "Book Consultation", url: "/consultation" },
              { label: "Contact", url: "/contact" },
            ]),
          },
          {
            key: "footer_newsletter_headline",
            label: "Newsletter headline",
            type: "text",
            default: "Collections, ateliers and invitations — first.",
          },
          { key: "footer_newsletter_placeholder", label: "Newsletter placeholder", type: "text", default: "Your email" },
          {
            key: "footer_copyright",
            label: "Copyright text",
            type: "text",
            default: "© 2026 Prudential Atelier. All rights reserved.",
          },
        ],
      },
    ],
  },
  {
    id: "legal",
    label: "Legal Pages",
    sections: [
      {
        id: "privacy",
        label: "Privacy Policy",
        fields: [{ key: "legal_privacy_policy", label: "Privacy Policy content", type: "richtext", default: "" }],
      },
      {
        id: "terms",
        label: "Terms & Conditions",
        fields: [{ key: "legal_terms", label: "Terms content", type: "richtext", default: "" }],
      },
      {
        id: "cookie",
        label: "Cookie Policy",
        fields: [{ key: "legal_cookie_policy", label: "Cookie Policy content", type: "richtext", default: "" }],
      },
      {
        id: "returns",
        label: "Returns Policy",
        fields: [{ key: "legal_returns_policy", label: "Returns Policy content", type: "richtext", default: "" }],
      },
      {
        id: "shipping",
        label: "Shipping Policy",
        fields: [{ key: "legal_shipping_policy", label: "Shipping Policy content", type: "richtext", default: "" }],
      },
    ],
  },
];

export const LEGAL_PAGE_META: Record<
  string,
  { title: string; route: string; contentKey: string; lastUpdated: string }
> = {
  privacy: {
    title: "Privacy Policy",
    route: "/privacy-policy",
    contentKey: "legal_privacy_policy",
    lastUpdated: "June 2026",
  },
  terms: {
    title: "Terms & Conditions",
    route: "/terms-and-conditions",
    contentKey: "legal_terms",
    lastUpdated: "June 2026",
  },
  cookie: {
    title: "Cookie Policy",
    route: "/cookie-policy",
    contentKey: "legal_cookie_policy",
    lastUpdated: "June 2026",
  },
  returns: {
    title: "Returns & Refunds Policy",
    route: "/returns-policy",
    contentKey: "legal_returns_policy",
    lastUpdated: "June 2026",
  },
  shipping: {
    title: "Shipping Policy",
    route: "/shipping-policy",
    contentKey: "legal_shipping_policy",
    lastUpdated: "June 2026",
  },
};

export function getAllCmsKeys(): string[] {
  const keys = new Set<string>();
  for (const page of CMS_PAGES) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        keys.add(field.key);
      }
    }
  }
  return Array.from(keys);
}

export function getPageById(pageId: string): CmsPageDef | undefined {
  return CMS_PAGES.find((p) => p.id === pageId);
}

export function getPageFieldKeys(pageId: string): string[] {
  const page = getPageById(pageId);
  if (!page) return [];
  return page.sections.flatMap((s) => s.fields.map((f) => f.key));
}

export function getDefaultValues(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const page of CMS_PAGES) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        out[field.key] = field.default;
      }
    }
  }
  return out;
}

export function getFieldDefault(key: string): string {
  return getDefaultValues()[key] ?? "";
}
