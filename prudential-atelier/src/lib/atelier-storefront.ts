/** SiteSetting key. Admin General Settings toggle; middleware reads it server-side. */
export const ATELIER_STOREFRONT_SETTING_KEY = "atelier_storefront_enabled";

/**
 * Public and account atelier surfaces that must 404 when the flag is off.
 * Admin / staff / API are not included.
 */
export function isAtelierStorefrontPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/atelier" || p.startsWith("/atelier/")) return true;
  if (p === "/bespoke" || p.startsWith("/bespoke/")) return true;
  if (p === "/bridal" || p.startsWith("/bridal/")) return true;
  if (p === "/bridesals" || p.startsWith("/bridesals/")) return true;
  if (p === "/consultation" || p.startsWith("/consultation/")) return true;
  if (p === "/quote" || p.startsWith("/quote/")) return true;
  if (p === "/track" || p.startsWith("/track/")) return true;
  if (p === "/account/consultations" || p.startsWith("/account/consultations/")) return true;
  if (p === "/account/measurements" || p.startsWith("/account/measurements/")) return true;
  if (p === "/account/moodboards" || p.startsWith("/account/moodboards/")) return true;
  if (p === "/account/orders/bespoke" || p.startsWith("/account/orders/bespoke/")) return true;
  return false;
}

export function isRtwCommercePath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/shop" || p.startsWith("/shop/")) return true;
  if (p === "/checkout" || p.startsWith("/checkout/")) return true;
  if (p === "/cart" || p.startsWith("/cart/")) return true;
  if (p === "/rtw" || p.startsWith("/rtw/")) return true;
  if (p === "/collections" || p.startsWith("/collections/")) return true;
  return false;
}

const ATELIER_HREFS = new Set([
  "/atelier",
  "/bespoke",
  "/bridal",
  "/bridesals",
  "/consultation",
  "/quote",
  "/track",
]);

export function isAtelierHref(href: string): boolean {
  const path = href.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (ATELIER_HREFS.has(path)) return true;
  return Array.from(ATELIER_HREFS).some((root) => path.startsWith(`${root}/`));
}

export function filterStorefrontLinks<T extends { href?: string; url?: string; label?: string }>(
  links: T[],
  atelierEnabled: boolean,
): T[] {
  return links.filter((link) => {
    if (isOrderTrackLink(link)) return false;
    if (atelierEnabled) return true;
    const href = (link.href ?? link.url ?? "").split("?")[0] ?? "";
    return !isAtelierHref(href);
  });
}

/** Footer Track is a login wall or a bespoke-only /track — hide until a public RTW tracker exists. */
export function isOrderTrackLink(link: { href?: string; url?: string; label?: string }): boolean {
  const label = (link.label ?? "").toLowerCase();
  if (label.includes("track")) return true;
  const path = (link.href ?? link.url ?? "").split("?")[0]?.replace(/\/+$/, "") || "/";
  return path === "/track" || path.startsWith("/track/");
}

/** True when the storefront must 404 this path (flag off, not a commerce route). */
export function shouldBlockAtelierStorefront(atelierEnabled: boolean, pathname: string): boolean {
  if (atelierEnabled) return false;
  if (isRtwCommercePath(pathname)) return false;
  return isAtelierStorefrontPath(pathname);
}

/** RTW guest/account order lookup — used when /track is bespoke-only. */
export function rtwOrderSuccessPath(orderNumber: string, email?: string | null): string {
  const q = new URLSearchParams({ order: orderNumber });
  if (email?.trim()) q.set("email", email.trim().toLowerCase());
  return `/checkout/success?${q.toString()}`;
}
