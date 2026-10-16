// The policy texts live in ./legal/*: NDPA 2023 + GDPR rewrite (revision nd-1, 15 October 2026).
import { PRIVACY_POLICY_MD } from "./legal/privacy-md";
import { TERMS_MD } from "./legal/terms-md";
import { COOKIE_MD } from "./legal/cookie-md";
import { RETURNS_MD, SHIPPING_MD } from "./legal/returns-shipping-md";

/** Canonical legal drafts. CMS can amend without a deploy.
 *  Bump a page's `revision` in LEGAL_SEED_ENTRIES to republish that page only.
 *  LEGAL_COPY_REVISION is the newest of those page stamps. */


export const LEGAL_COPY_REVISION = "nd-3";
export const DEFAULT_LEGAL_UPDATED = "15 October 2026";

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Converts the house markdown-style legal text to HTML for TipTap / legal pages. */
export function legalMdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").trim().split("\n");
  const parts: string[] = [];
  let i = 0;

  const flushList = (kind: "ul" | "ol", items: string[]) => {
    if (!items.length) return;
    const tag = kind;
    parts.push(`<${tag}>${items.map((item) => `<li>${inlineMd(item)}</li>`).join("")}</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3).trim();
      const id = slugifyHeading(text);
      parts.push(`<h2 id="${id}">${escapeHtml(text)}</h2>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4).trim();
      const id = slugifyHeading(text);
      parts.push(`<h3 id="${id}">${escapeHtml(text)}</h3>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("- ")) {
        items.push(lines[i]!.trim().replace(/^- /, ""));
        i += 1;
      }
      flushList("ul", items);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s/, ""));
        i += 1;
      }
      flushList("ol", items);
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!.trim();
      if (!next || next.startsWith("## ") || next.startsWith("### ") || next.startsWith("- ") || /^\d+\.\s/.test(next)) {
        break;
      }
      para.push(next);
      i += 1;
    }
    parts.push(`<p>${inlineMd(para.join(" "))}</p>`);
  }

  return parts.join("\n");
}

export type LegalTocItem = { id: string; text: string };

export function extractLegalToc(html: string): LegalTocItem[] {
  const items: LegalTocItem[] = [];
  const re = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1] ?? "";
    const text = (m[2] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
    if (!text) continue;
    const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs);
    items.push({ id: idMatch?.[1] || slugifyHeading(text), text });
  }
  return items;
}


export { PRIVACY_POLICY_MD, TERMS_MD, COOKIE_MD, RETURNS_MD, SHIPPING_MD };

export type LegalPageKey = "privacy" | "terms" | "cookie" | "returns" | "shipping";

export const LEGAL_MARKDOWN: Record<LegalPageKey, string> = {
  privacy: PRIVACY_POLICY_MD,
  terms: TERMS_MD,
  cookie: COOKIE_MD,
  returns: RETURNS_MD,
  shipping: SHIPPING_MD,
};

export const LEGAL_HTML: Record<LegalPageKey, string> = {
  privacy: legalMdToHtml(PRIVACY_POLICY_MD),
  terms: legalMdToHtml(TERMS_MD),
  cookie: legalMdToHtml(COOKIE_MD),
  returns: legalMdToHtml(RETURNS_MD),
  shipping: legalMdToHtml(SHIPPING_MD),
};

export const LEGAL_SEED_ENTRIES: {
  page: LegalPageKey;
  key: string;
  label: string;
  updatedKey: string;
  md: string;
  revision: string;
}[] = [
  { page: "privacy", key: "legal_privacy_policy", label: "Privacy Policy", updatedKey: "legal_privacy_updated", md: PRIVACY_POLICY_MD, revision: "nd-3" },
  { page: "terms", key: "legal_terms", label: "Terms & Conditions", updatedKey: "legal_terms_updated", md: TERMS_MD, revision: "nd-1" },
  { page: "cookie", key: "legal_cookie_policy", label: "Cookie Policy", updatedKey: "legal_cookie_updated", md: COOKIE_MD, revision: "nd-3" },
  { page: "returns", key: "legal_returns_policy", label: "Returns Policy", updatedKey: "legal_returns_updated", md: RETURNS_MD, revision: "nd-1" },
  { page: "shipping", key: "legal_shipping_policy", label: "Shipping Policy", updatedKey: "legal_shipping_updated", md: SHIPPING_MD, revision: "nd-1" },
];
