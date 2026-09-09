export type AboutLook = { url: string; alt: string };
export type AboutStat = { number: string; label: string };

/** Drop CMS counts that claim more than one house / store / atelier. */
export function isInflatedLocationStat(label: string, number: string): boolean {
  if (!/\b(stores?|locations?|ateliers?|branches?|showrooms?)\b/i.test(label)) return false;
  const n = Number.parseInt(number.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 1;
}

export function filterAboutStats(stats: AboutStat[]): AboutStat[] {
  return stats.filter((stat) => stat.number.trim() && stat.label.trim() && !isInflatedLocationStat(stat.label, stat.number));
}

export function pickAboutLooks(candidates: AboutLook[], limit = 3): AboutLook[] {
  const seen = new Set<string>();
  const out: AboutLook[] = [];
  for (const look of candidates) {
    const url = look.url.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, alt: look.alt.trim() || "Prudential Atelier" });
    if (out.length >= limit) break;
  }
  return out;
}

export function houseCtaLabel(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.endsWith("→") ? trimmed.slice(0, -1).trimEnd() : trimmed;
}
