import type { FieldErrors, FieldValues } from "react-hook-form";

/** Depth-first first leaf error path, e.g. `optionGroup.label` or `variants.0.size`. */
export function getFirstErrorPath(errors: FieldErrors<FieldValues>): string | null {
  const walk = (node: unknown, prefix: string[]): string | null => {
    if (!node || typeof node !== "object") return null;
    const rec = node as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message) {
      return prefix.length ? prefix.join(".") : null;
    }
    for (const [key, child] of Object.entries(rec)) {
      if (key === "ref" || key === "type" || key === "types" || key === "root") continue;
      const found = walk(child, [...prefix, key]);
      if (found) return found;
    }
    return null;
  };
  return walk(errors, []);
}

export function firstErrorMessage(errors: FieldErrors<FieldValues>): string | null {
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const rec = node as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message) return rec.message;
    for (const [key, child] of Object.entries(rec)) {
      if (key === "ref" || key === "type" || key === "types") continue;
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(errors);
}

/**
 * Focus and scroll to a field. Prefer `id`, then `[name=…]`, then `[data-field=…]`.
 * Safe for ladies who miss a field — brings the problem into view.
 */
export function focusField(idOrName: string) {
  if (typeof document === "undefined") return;
  const el =
    document.getElementById(idOrName) ??
    (document.querySelector(`[name="${CSS.escape(idOrName)}"]`) as HTMLElement | null) ??
    (document.querySelector(`[data-field="${CSS.escape(idOrName)}"]`) as HTMLElement | null);
  if (!el) return;
  const focusable =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLButtonElement
      ? el
      : (el.querySelector("input, textarea, select, [contenteditable='true'], button") as HTMLElement | null);
  (focusable ?? el).scrollIntoView({ behavior: "smooth", block: "center" });
  try {
    (focusable ?? el).focus({ preventScroll: true });
  } catch {
    /* non-focusable */
  }
  el.classList.add("ring-2", "ring-[var(--error)]/50");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-[var(--error)]/50"), 1600);
}

/** Strip tags for empty-check on TipTap / CMS HTML. */
export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmptyRichText(html: string | null | undefined): boolean {
  if (!html) return true;
  return plainTextFromHtml(html).length === 0;
}

/** Pull a readable message from API `{ error: string | flatten() }`. */
export function apiErrorMessage(data: unknown, fallback = "Could not save"): string {
  if (!data || typeof data !== "object") return fallback;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
    const form = flat.formErrors?.find((m) => m?.trim());
    if (form) return form;
    if (flat.fieldErrors) {
      for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
        const msg = msgs?.find((m) => m?.trim());
        if (msg) return `${key}: ${msg}`;
      }
    }
  }
  return fallback;
}
