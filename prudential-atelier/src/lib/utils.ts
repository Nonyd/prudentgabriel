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
  const d = typeof value === "string" ? new Date(value) : value;
  return formatDateFns(d, pattern);
}

// ── Price formatting ──
type Currency = "NGN" | "USD" | "GBP";

export function formatPrice(amount: number, currency: Currency): string {
  const formatters: Record<Currency, Intl.NumberFormat> = {
    NGN: new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }),
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
