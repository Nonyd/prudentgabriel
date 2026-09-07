/** Copy helpers for the /rtw landing hero. CMS-managed; old "Ready-to-Wear" titles do not win. */

export const RTW_HERO_HEADLINE = "Cut in Lagos when you order";
export const RTW_HERO_SUBLINE = "Made in Lagos. Ready in 7-12 days.";
export const RTW_HERO_CTA = "See the collection";
export const RTW_PROMISE_BAND = "Every piece is made for you in 7-12 days.";
export const RTW_GRID_ID = "rtw-grid";

const PREVIOUS_HEADLINES = ["Ready-to-Wear", "Ready to Wear", "THE COLLECTION"];
const PREVIOUS_SUBLINES = ["", "THE COLLECTION"];

function firstCustom(previous: string[], ...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    const v = candidate?.trim();
    if (v && !previous.includes(v)) return v;
  }
  return undefined;
}

export function rtwHeroCopy(stored: {
  headline?: string;
  legacyTitle?: string;
  subline?: string;
  legacySubtitle?: string;
  cta?: string;
  promise?: string;
}) {
  return {
    headline: firstCustom(PREVIOUS_HEADLINES, stored.headline, stored.legacyTitle) ?? RTW_HERO_HEADLINE,
    subline: firstCustom(PREVIOUS_SUBLINES, stored.subline, stored.legacySubtitle) ?? RTW_HERO_SUBLINE,
    cta: firstCustom([], stored.cta) ?? RTW_HERO_CTA,
    promise: firstCustom([], stored.promise) ?? RTW_PROMISE_BAND,
  };
}

/** iOS plays MP4/H.264. Same rewrite the homepage carousel uses. */
export function rtwHeroPlaybackUrl(url: string): string {
  let out = url;
  if (out.includes("/video/upload/") && !/\/upload\/[^/]*f_(mp4|auto)/.test(out)) {
    out = out.replace("/video/upload/", "/video/upload/f_mp4,q_auto,vc_h264/");
  }
  if (out.startsWith("/media/") && !out.includes("pgv=")) {
    out += out.includes("?") ? "&pgv=3" : "?pgv=3";
  }
  return out;
}
