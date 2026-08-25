/** Footer Track is a login wall or a bespoke-only /track — hide until a public RTW tracker exists. */
export function isOrderTrackLink(link: { href?: string; url?: string; label?: string }): boolean {
  const label = (link.label ?? "").toLowerCase();
  if (label.includes("track")) return true;
  const path = (link.href ?? link.url ?? "").split("?")[0]?.replace(/\/+$/, "") || "/";
  return path === "/track" || path.startsWith("/track/");
}

export function filterStorefrontLinks<T extends { href?: string; url?: string; label?: string }>(
  links: T[],
): T[] {
  return links.filter((link) => !isOrderTrackLink(link));
}

/** RTW guest/account order lookup — used when /track is bespoke-only. */
export function rtwOrderSuccessPath(orderNumber: string, email?: string | null): string {
  const q = new URLSearchParams({ order: orderNumber });
  if (email?.trim()) q.set("email", email.trim().toLowerCase());
  return `/checkout/success?${q.toString()}`;
}
