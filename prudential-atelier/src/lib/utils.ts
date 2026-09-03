import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import slugify from "slugify";
import { format as formatDateFns } from "date-fns";

// ── Class merging utility ──
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function slugifyText(text: string): string {
  return slugify(text, { lower: true, strict: true });
}

/** date-fns formatted date (existing helper) */
export function formatDate(value: Date | string, pattern = "PPP"): string {
  return formatDateFns(new Date(value), pattern);
}

// ── Price formatting ──
type Currency = "NGN" | "USD" | "GBP";

/** Naira formatter — sans-serif safe (avoids ₦+0 serif ligature rendering as "NO"). */
export function formatNGN(amount: number): string {
  return `\u20A6${Math.round(amount).toLocaleString("en-NG")}`;
}

export function formatPrice(amount: number, currency: Currency): string {
  if (currency === "NGN") {
    return formatNGN(amount);
  }
  const formatters: Record<Exclude<Currency, "NGN">, Intl.NumberFormat> = {
    USD: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }),
    GBP: new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
    }),
  };
  return formatters[currency].format(amount);
}

// ── Order number generator ──
// Format: PA-YYYY-XXXXX (e.g. PA-2024-00042)
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const id = Math.floor(10000 + Math.random() * 90000);
  return `PA-${year}-${id}`;
}

// ── Bespoke request number ──
// Format: BQ-YYYY-XXXX (e.g. BQ-2024-0012)
export function generateRequestNumber(): string {
  const year = new Date().getFullYear();
  const id = Math.floor(1000 + Math.random() * 9000);
  return `BQ-${year}-${id}`;
}

// ── SKU generator ──
export function generateSKU(productSlug: string, size: string): string {
  return `${productSlug}-${size.toLowerCase().replace(/\s+/g, "-")}`;
}

// ── Text truncation ──
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

// ── Slugify ──
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Initials from name ──
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Date formatting (locale) ──
export function formatLocaleDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Delay utility (for async operations) ──
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Storefront image URLs. Local `/media/` paths become absolute so next/image can optimise them. */
export function optimizeImageUrl(url: string, width = 600): string {
  if (!url || url.startsWith("data:")) return url;

  if (url.startsWith("/media/")) {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
    return origin ? `${origin}${url}` : url;
  }

  if (url.includes("res.cloudinary.com")) {
    const marker = "/upload/";
    const idx = url.indexOf(marker);
    if (idx === -1) return url;
    const after = url.slice(idx + marker.length);
    if (/^(q_auto|f_auto|w_\d|c_fill|v\d)/.test(after)) return url;
    return `${url.slice(0, idx + marker.length)}c_fill,g_top,w_${width},q_auto,f_auto/${after.replace(/^\/+/, "")}`;
  }

  if (url.includes("images.unsplash.com")) {
    try {
      const u = new URL(url);
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "85");
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}
