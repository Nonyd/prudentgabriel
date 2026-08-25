import { FALLBACK_CAROUSEL_ITEMS } from "@/lib/hero-carousel";
import {
  DEFAULT_ABOUT_VALUES,
  DEFAULT_BRIDAL_INTRO,
  DEFAULT_BRIDAL_NOTES,
  DEFAULT_KIDS_SIZE_CHART,
  DEFAULT_MEASURE_STEPS,
  DEFAULT_SIZE_TIP,
  DEFAULT_WOMEN_SIZE_CHART,
} from "@/lib/page-content-defaults";

export type CmsFieldType =
  | "text"
  | "textarea"
  | "toggle"
  | "number"
  | "select"
  | "image"
  | "richtext"
  | "messages"
  | "links"
  | "carousel";

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
  { key: `${prefix}_enabled`, label: "Enabled", type: "toggle", default: defaults.enabled ?? "true" },
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
          { key: "home_hero_image", label: "Hero image (legacy fallback)", type: "image", default: "", uploadFolder: "prudent-gabriel/hero" },
          {
            key: "home_hero_carousel",
            label: "Hero media carousel",
            type: "carousel",
            default: JSON.stringify(FALLBACK_CAROUSEL_ITEMS),
          },
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
      {
        id: "testimonials",
        label: "Testimonials Section",
        fields: [
          { key: "home_testimonials_enabled", label: "Enabled", type: "toggle", default: "true" },
          {
            key: "home_testimonials_heading",
            label: "Section heading",
            type: "text",
            default: "What our clients say",
          },
          {
            key: "home_testimonials_subtitle",
            label: "Section subtitle (optional)",
            type: "textarea",
            default: "",
          },
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
        id: "type_physical_prudent",
        label: "Physical — Mrs. Prudent + Creative Team",
        fields: consultationTypeFields("consultation_type_physical_prudent", {
          badge: "PHYSICAL",
          title: "Mrs. Prudent Gabriel-Okopi & The Creative Team",
          description: "A private session led by Mrs. Prudent herself.",
          feature1: "Led by Mrs. Prudent",
          feature2: "Full creative team",
          feature3: "Up to 90 minutes",
          priceNgn: "150000",
          priceUsd: "120",
          priceGbp: "95",
          duration: "Up to 90 minutes",
          enabled: "true",
        }),
      },
      {
        id: "type_physical_team",
        label: "Physical — Creative Team Only",
        fields: consultationTypeFields("consultation_type_physical_team", {
          badge: "PHYSICAL",
          title: "The Creative Team",
          description: "Work with our senior designers in our Lagos atelier.",
          feature1: "Senior design team",
          feature2: "In-atelier fabric viewing",
          feature3: "Up to 60 minutes",
          priceNgn: "75000",
          priceUsd: "60",
          priceGbp: "48",
          duration: "Up to 60 minutes",
          enabled: "true",
        }),
      },
      {
        id: "type_virtual_prudent",
        label: "Virtual — Mrs. Prudent + Creative Team",
        fields: consultationTypeFields("consultation_type_virtual_prudent", {
          badge: "VIRTUAL",
          title: "Mrs. Prudent Gabriel-Okopi & The Creative Team",
          description: "Meet virtually with Mrs. Prudent from anywhere.",
          feature1: "Led by Mrs. Prudent",
          feature2: "Full creative team",
          feature3: "Up to 60 minutes",
          priceNgn: "60000",
          priceUsd: "48",
          priceGbp: "38",
          duration: "Up to 60 minutes",
          enabled: "true",
        }),
      },
      {
        id: "type_virtual_team",
        label: "Virtual — Creative Team Only",
        fields: consultationTypeFields("consultation_type_virtual_team", {
          badge: "VIRTUAL",
          title: "The Creative Team",
          description: "Connect with our designers from anywhere.",
          feature1: "Senior design team",
          feature2: "Screen-shared lookbook",
          feature3: "Up to 45 minutes",
          priceNgn: "40000",
          priceUsd: "32",
          priceGbp: "26",
          duration: "Up to 45 minutes",
          enabled: "true",
        }),
      },
    ],
  },
  {
    id: "contact",
    label: "Contact",
    previewPath: "/contact",
    sections: [
      {
        id: "details",
        label: "Contact Details",
        fields: [
          { key: "contact_lagos_address_1", label: "Lagos address (line 1)", type: "text", default: "14 Bode Thomas Street" },
          { key: "contact_lagos_address_2", label: "Lagos address (line 2)", type: "text", default: "Surulere, Lagos, Nigeria" },
          { key: "contact_abuja_address_1", label: "Abuja address (line 1)", type: "text", default: "Plot 1234, Wuse Zone 5" },
          { key: "contact_abuja_address_2", label: "Abuja address (line 2)", type: "text", default: "Abuja, FCT, Nigeria" },
          { key: "contact_whatsapp", label: "WhatsApp number", type: "text", default: "+2348012345678" },
          { key: "contact_phone", label: "Phone number", type: "text", default: "+2348012345678" },
          { key: "contact_email", label: "Email", type: "text", default: "hello@prudentgabriel.com" },
          { key: "contact_hours_weekday", label: "Hours (Mon–Fri)", type: "text", default: "Monday – Friday: 9:00 AM – 6:00 PM" },
          { key: "contact_hours_saturday", label: "Hours (Saturday)", type: "text", default: "Saturday: 10:00 AM – 4:00 PM" },
          { key: "contact_instagram", label: "Instagram handle", type: "text", default: "@prudentgabriel" },
          { key: "contact_tiktok", label: "TikTok handle", type: "text", default: "@prudentgabriel" },
          { key: "contact_facebook", label: "Facebook page name", type: "text", default: "Prudential Atelier" },
        ],
      },
      {
        id: "form",
        label: "Contact Form",
        fields: [
          {
            key: "contact_auto_reply_message",
            label: "Auto-reply message",
            type: "textarea",
            default: "Thank you for reaching out. We'll be in touch within 24 hours.",
          },
          {
            key: "contact_notification_email",
            label: "Notification email (form submissions)",
            type: "text",
            default: "hello@prudentgabriel.com",
          },
        ],
      },
    ],
  },
  {
    id: "size-guide",
    label: "Size Guide",
    previewPath: "/size-guide",
    sections: [
      {
        id: "charts",
        label: "Size Charts",
        fields: [
          {
            key: "size_guide_women",
            label: "Women's size chart (JSON)",
            type: "textarea",
            default: JSON.stringify(DEFAULT_WOMEN_SIZE_CHART),
          },
          {
            key: "size_guide_kids",
            label: "Kids size chart (JSON)",
            type: "textarea",
            default: JSON.stringify(DEFAULT_KIDS_SIZE_CHART),
          },
          {
            key: "size_guide_bridal_intro",
            label: "Bridal intro",
            type: "textarea",
            default: DEFAULT_BRIDAL_INTRO,
          },
          {
            key: "size_guide_bridal_notes",
            label: "Bridal sizing notes",
            type: "textarea",
            default: DEFAULT_BRIDAL_NOTES,
          },
          { key: "size_guide_size_tip", label: "Between sizes tip", type: "textarea", default: DEFAULT_SIZE_TIP },
        ],
      },
      {
        id: "measure",
        label: "How to Measure",
        fields: [
          {
            key: "size_guide_measure_steps",
            label: "Measurement steps (JSON: title, description)",
            type: "textarea",
            default: JSON.stringify(DEFAULT_MEASURE_STEPS),
          },
        ],
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
          { key: "about_hero_headline", label: "Headline", type: "text", default: "The House of Prudent Gabriel" },
          {
            key: "about_hero_subtext",
            label: "Subheadline",
            type: "text",
            default: "Founded in Lagos. Worn around the world.",
          },
        ],
      },
      {
        id: "story",
        label: "Brand Story",
        fields: [
          { key: "about_story_eyebrow", label: "Eyebrow", type: "text", default: "OUR STORY" },
          { key: "about_story_headline", label: "Headline", type: "text", default: "From a dream to a dynasty." },
          {
            key: "about_story_paragraph_1",
            label: "Paragraph 1",
            type: "textarea",
            default:
              "Prudential Atelier was born from a single, unwavering belief — that every woman deserves to be dressed with intention. Founded in Lagos by Mrs. Prudent Gabriel-Okopi, the house began as a quiet vision in a small studio and grew, through dedication and extraordinary craft, into one of Nigeria's most celebrated luxury fashion houses.",
          },
          {
            key: "about_story_paragraph_2",
            label: "Paragraph 2",
            type: "textarea",
            default:
              "Today, Prudential Atelier serves clients across Nigeria, the United Kingdom, the United States, and beyond — crafting bespoke commissions, ready-to-wear collections, and bridal wear that speak to the modern African woman in all her power and grace.",
          },
          {
            key: "about_story_paragraph_3",
            label: "Paragraph 3",
            type: "textarea",
            default:
              "Each piece is conceived in our Lagos atelier, hand-finished by our team of master tailors and beaders, and delivered to clients who understand that true luxury is not purchased — it is commissioned.",
          },
          {
            key: "about_story_body",
            label: "Brand story (legacy rich text)",
            type: "richtext",
            default:
              "<p>Founded in Lagos, Prudential Atelier crafts ready-to-wear, bridal, and made-to-measure commissions for women who expect more from what they wear.</p>",
          },
          {
            key: "about_story_image",
            label: "Story image",
            type: "image",
            default: "",
            uploadFolder: "prudent-gabriel/about",
          },
        ],
      },
      {
        id: "founder",
        label: "Founder",
        fields: [
          { key: "about_founder_name", label: "Name", type: "text", default: "Mrs. Prudent Gabriel-Okopi" },
          { key: "about_founder_title", label: "Title", type: "text", default: "Founder & Creative Director" },
          { key: "about_founder_photo", label: "Photo", type: "image", default: "", uploadFolder: "prudent-gabriel/about" },
          {
            key: "about_founder_bio_1",
            label: "Bio paragraph 1",
            type: "textarea",
            default:
              "Mrs. Prudent Gabriel-Okopi is the founder and creative director of Prudential Atelier, Nigeria's premier luxury fashion house. With over 15 years of experience in fashion design and garment construction, she has built a house synonymous with exceptional craftsmanship, cultural pride, and international elegance.",
          },
          {
            key: "about_founder_bio_2",
            label: "Bio paragraph 2",
            type: "textarea",
            default:
              "A visionary who trained under some of Nigeria's finest designers, Mrs. Prudent founded the atelier with a clear mandate: to create pieces that celebrate the African woman in all her dimensions — her power, her femininity, her ambition, and her grace.",
          },
          {
            key: "about_founder_bio_3",
            label: "Bio paragraph 3",
            type: "textarea",
            default:
              "Under her creative direction, Prudential Atelier has dressed women for state dinners, royal ceremonies, international galas, and intimate celebrations — each commission a reflection of her unwavering commitment to excellence.",
          },
          {
            key: "about_founder_quote",
            label: "Founder quote",
            type: "textarea",
            default: "We don't make clothes. We make the way you'll be remembered.",
          },
        ],
      },
      {
        id: "stats",
        label: "By the Numbers",
        fields: [
          { key: "about_stat_1_number", label: "Stat 1 number", type: "text", default: "15+" },
          { key: "about_stat_1_label", label: "Stat 1 label", type: "text", default: "Years of Couture" },
          { key: "about_stat_2_number", label: "Stat 2 number", type: "text", default: "500+" },
          { key: "about_stat_2_label", label: "Stat 2 label", type: "text", default: "Commissions Delivered" },
          { key: "about_stat_3_number", label: "Stat 3 number", type: "text", default: "10,000+" },
          { key: "about_stat_3_label", label: "Stat 3 label", type: "text", default: "Happy Clients" },
          { key: "about_stat_4_number", label: "Stat 4 number", type: "text", default: "4" },
          { key: "about_stat_4_label", label: "Stat 4 label", type: "text", default: "Atelier Locations" },
        ],
      },
      {
        id: "values",
        label: "Our Values",
        fields: [
          { key: "about_values_eyebrow", label: "Eyebrow", type: "text", default: "WHAT WE STAND FOR" },
          { key: "about_values_headline", label: "Headline", type: "text", default: "The principles behind every piece" },
          {
            key: "about_values",
            label: "Values (JSON: name, description)",
            type: "textarea",
            default: JSON.stringify(DEFAULT_ABOUT_VALUES),
          },
        ],
      },
      {
        id: "locations",
        label: "Locations",
        fields: [
          { key: "about_locations_eyebrow", label: "Eyebrow", type: "text", default: "OUR ATELIERS" },
          { key: "about_locations_headline", label: "Headline", type: "text", default: "Where to find us" },
          { key: "about_lagos_name", label: "Lagos name", type: "text", default: "LAGOS" },
          {
            key: "about_lagos_address",
            label: "Lagos address",
            type: "textarea",
            default: "14 Bode Thomas Street\nSurulere, Lagos",
          },
          { key: "about_lagos_hours", label: "Lagos hours", type: "text", default: "Mon–Fri: 9am–6pm · Sat: 10am–4pm" },
          {
            key: "about_lagos_maps_link",
            label: "Lagos maps link",
            type: "text",
            default: "https://maps.google.com/?q=Surulere,Lagos,Nigeria",
          },
          { key: "about_abuja_name", label: "Abuja name", type: "text", default: "ABUJA" },
          {
            key: "about_abuja_address",
            label: "Abuja address",
            type: "textarea",
            default: "Plot 1234, Wuse Zone 5\nAbuja, FCT",
          },
          { key: "about_abuja_hours", label: "Abuja hours", type: "text", default: "Mon–Fri: 9am–6pm · Sat: 10am–4pm" },
          {
            key: "about_abuja_maps_link",
            label: "Abuja maps link",
            type: "text",
            default: "https://maps.google.com/?q=Wuse+Zone+5,Abuja,Nigeria",
          },
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
          { key: "about_academy_cta_link", label: "CTA link", type: "text", default: "/about#academy" },
        ],
      },
      {
        id: "cta",
        label: "Final CTA",
        fields: [
          { key: "about_cta_headline", label: "Headline", type: "text", default: "Ready to begin your commission?" },
          {
            key: "about_cta_quote",
            label: "Quote",
            type: "textarea",
            default: "Every great piece begins with a conversation.",
          },
          { key: "about_cta_button_1_label", label: "Button 1 label", type: "text", default: "BOOK A CONSULTATION →" },
          { key: "about_cta_button_1_link", label: "Button 1 link", type: "text", default: "/consultation" },
          { key: "about_cta_button_2_label", label: "Button 2 label", type: "text", default: "BROWSE THE COLLECTION →" },
          { key: "about_cta_button_2_link", label: "Button 2 link", type: "text", default: "/shop" },
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
              { label: "Careers", url: "/careers" },
              { label: "Fashion Academy", url: "/about#academy" },
              { label: "Journal", url: "/journal" },
            ]),
          },
          {
            key: "footer_client_links",
            label: "CLIENT CARE column links",
            type: "links",
            default: JSON.stringify([
              { label: "Size Guide", url: "/size-guide" },
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

export type CmsPageGroup = {
  id: string;
  label: string;
  pageIds: string[];
};

/** Sidebar grouping for the Pages CMS — keeps related pages together. */
export const CMS_PAGE_GROUPS: CmsPageGroup[] = [
  {
    id: "main",
    label: "Main site",
    pageIds: ["homepage", "about", "contact", "size-guide", "footer"],
  },
  {
    id: "brands",
    label: "Brands & services",
    pageIds: ["atelier", "bridal", "kids", "consultation", "shop", "rtw", "track"],
  },
  {
    id: "journal",
    label: "Journal",
    pageIds: ["journal"],
  },
  {
    id: "legal",
    label: "Legal & policies",
    pageIds: ["legal"],
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
