export interface HeroCarouselItem {
  type: "image" | "video";
  url: string;
  alt?: string;
}

export const FALLBACK_CAROUSEL_ITEMS: HeroCarouselItem[] = [
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600",
    alt: "Prudent Gabriel Collection",
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600",
    alt: "Prudent Gabriel Atelier",
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600",
    alt: "Prudent Gabriel Bridal",
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600",
    alt: "Prudent Gabriel Ready to Wear",
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600",
    alt: "Prudent Gabriel Lagos",
  },
];

export function parseHeroCarouselItems(raw: string | null | undefined): HeroCarouselItem[] {
  if (!raw?.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry): HeroCarouselItem | null => {
        if (!entry || typeof entry !== "object") return null;
        const item = entry as Record<string, unknown>;
        const type = item.type === "video" ? "video" : item.type === "image" ? "image" : null;
        const url = typeof item.url === "string" ? item.url.trim() : "";
        if (!type || !url) return null;
        const alt = typeof item.alt === "string" ? item.alt : undefined;
        return { type, url, ...(alt ? { alt } : {}) };
      })
      .filter((item): item is HeroCarouselItem => item !== null);
  } catch {
    return [];
  }
}

export function resolveHeroCarouselItems(raw: string | null | undefined): HeroCarouselItem[] {
  const parsed = parseHeroCarouselItems(raw);
  return parsed.length > 0 ? parsed : FALLBACK_CAROUSEL_ITEMS;
}
