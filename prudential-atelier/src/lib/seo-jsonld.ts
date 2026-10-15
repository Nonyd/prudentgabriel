import { absolutePublicUrl, getPublicAppUrl } from "@/lib/app-url";
import { HOUSE_ADDRESS_LINE_1, HOUSE_ADDRESS_LINE_2, HOUSE_MAPS_LINK } from "@/lib/house-address";
import {
  HOUSE_ALT_NAMES,
  HOUSE_DESCRIPTION,
  HOUSE_FOUNDER,
  HOUSE_KNOWS_ABOUT,
  HOUSE_NAME,
} from "@/lib/seo-copy";
import { instagramHandleToUrl } from "@/lib/sub-brand";

export type JsonLd = Record<string, unknown>;

export function organizationJsonLd(input: {
  logo?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  /** Making time before dispatch, from the live production-time setting. */
  handlingDays?: { min: number; max: number } | null;
}): JsonLd {
  const sameAs = [
    input.instagram ? instagramHandleToUrl(input.instagram) : "https://instagram.com/the_prudentgabriel",
    input.tiktok
      ? `https://tiktok.com/@${input.tiktok.replace(/^@/, "")}`
      : "https://tiktok.com/@prudentgabriel",
    input.facebook
      ? `https://facebook.com/${input.facebook.replace(/^@/, "")}`
      : "https://facebook.com/prudentgabriel",
    "https://instagram.com/prudential_atelier",
    "https://instagram.com/prudential_bridal",
    "https://instagram.com/prudential_kids",
  ];
  const logo = input.logo?.trim() ? absolutePublicUrl(input.logo) : undefined;
  const url = getPublicAppUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name: HOUSE_NAME,
    alternateName: [...HOUSE_ALT_NAMES],
    description: HOUSE_DESCRIPTION,
    url,
    ...(logo ? { logo } : {}),
    founder: { "@type": "Person", name: HOUSE_FOUNDER, jobTitle: "Creative Director" },
    foundingLocation: { "@type": "Place", name: "Lagos, Nigeria" },
    areaServed: ["Lagos", "Nigeria", "Worldwide"],
    knowsAbout: [...HOUSE_KNOWS_ABOUT],
    address: {
      "@type": "PostalAddress",
      streetAddress: HOUSE_ADDRESS_LINE_1,
      addressLocality: "Ajah",
      addressRegion: "Lagos",
      addressCountry: "NG",
      description: HOUSE_ADDRESS_LINE_2,
    },
    sameAs,
    // Google's recommended home for shop-wide handling time (merchant shipping
    // policy): every piece is made after the order, then shipped.
    ...(input.handlingDays
      ? {
          hasShippingService: {
            "@type": "ShippingService",
            name: "Made to order, then shipped",
            handlingTime: {
              "@type": "ServicePeriod",
              duration: {
                "@type": "QuantitativeValue",
                minValue: input.handlingDays.min,
                maxValue: input.handlingDays.max,
                unitCode: "DAY",
              },
            },
            shippingConditions: {
              "@type": "ShippingConditions",
              shippingOrigin: { "@type": "DefinedRegion", addressCountry: "NG" },
            },
          },
        }
      : {}),
  };
}

/**
 * The atelier as a place: what Google Maps and "fashion brands in Lagos" answers
 * read. Same house as the Organization (parentOrganization), a separate node.
 */
export function storeJsonLd(input: { logo?: string | null; image?: string | null }): JsonLd {
  const url = getPublicAppUrl();
  const logo = input.logo?.trim() ? absolutePublicUrl(input.logo) : undefined;
  const image = input.image?.trim() ? absolutePublicUrl(input.image) : logo;
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    "@id": `${url}/#store`,
    name: HOUSE_NAME,
    alternateName: [...HOUSE_ALT_NAMES],
    description: HOUSE_DESCRIPTION,
    url,
    ...(image ? { image } : {}),
    ...(logo ? { logo } : {}),
    parentOrganization: { "@id": `${url}/#organization` },
    address: {
      "@type": "PostalAddress",
      streetAddress: HOUSE_ADDRESS_LINE_1,
      addressLocality: "Ajah",
      addressRegion: "Lagos",
      addressCountry: "NG",
    },
    hasMap: HOUSE_MAPS_LINK,
    areaServed: ["Lagos", "Nigeria", "Worldwide"],
    currenciesAccepted: "NGN, USD, GBP",
    keywords: HOUSE_KNOWS_ABOUT.join(", "),
  };
}

/** Lets Google show "Prudent Gabriel" as the site name and offer a sitelinks search box. */
export function websiteJsonLd(): JsonLd {
  const url = getPublicAppUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}/#website`,
    name: "Prudent Gabriel",
    alternateName: [HOUSE_NAME, "prudentgabriel.com"],
    url,
    inLanguage: "en-NG",
    publisher: { "@id": `${url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${url}/rtw?search={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Questions answered on the page itself; the JSON-LD must match what is visible. */
export function faqJsonLd(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function productJsonLd(input: {
  name: string;
  description: string;
  images: string[];
  url: string;
  priceNGN: number;
  /** Catalogue publish date — same value Newest first sorts on. */
  datePublished?: string | Date | null;
  /** schema.org ItemAvailability URL — see product-orderability.ts. */
  availability: string;
}): JsonLd {
  const images = input.images.filter(Boolean).map((u) => absolutePublicUrl(u));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description.replace(/\s+/g, " ").trim(),
    image: images,
    brand: { "@type": "Brand", name: HOUSE_NAME },
    ...(input.datePublished
      ? { releaseDate: new Date(input.datePublished).toISOString() }
      : {}),
    offers: {
      "@type": "Offer",
      url: input.url,
      priceCurrency: "NGN",
      price: String(Math.round(input.priceNGN)),
      availability: input.availability,
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolutePublicUrl(item.path),
    })),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  datePublished?: string | Date | null;
  dateModified?: string | Date | null;
  authorName?: string | null;
}): JsonLd {
  const image = input.image?.trim() ? absolutePublicUrl(input.image) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: input.url,
    url: input.url,
    ...(image ? { image } : {}),
    author: {
      "@type": "Person",
      name: input.authorName?.trim() || "Prudent Gabriel",
    },
    publisher: {
      "@type": "Organization",
      name: HOUSE_NAME,
      url: getPublicAppUrl(),
    },
    ...(input.datePublished
      ? { datePublished: new Date(input.datePublished).toISOString() }
      : {}),
    ...(input.dateModified
      ? { dateModified: new Date(input.dateModified).toISOString() }
      : {}),
  };
}

export function productBreadcrumbItems(input: {
  aisleHref: string;
  aisleLabel: string;
  categoryLabel: string;
  name: string;
  slug: string;
}): { name: string; path: string }[] {
  return [
    { name: input.aisleLabel, path: input.aisleHref },
    { name: input.categoryLabel, path: input.aisleHref },
    { name: input.name, path: `/shop/${input.slug}` },
  ];
}
