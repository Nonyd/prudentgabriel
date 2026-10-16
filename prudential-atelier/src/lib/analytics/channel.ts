import type { VisitAttribution } from "@/lib/analytics/attribution";

export const CHANNELS = ["Direct", "Search", "Social", "Email", "Paid", "Referral", "Campaign"] as const;
export type Channel = (typeof CHANNELS)[number];

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|brave|startpage|qwant)\./;
const SOCIAL =
  /(^|\.)(instagram|facebook|fb|messenger|whatsapp|wa|tiktok|twitter|x|t|pinterest|linkedin|lnkd|snapchat|youtube|threads|reddit|telegram)\.(com|me|co|net|in|org)$/;
const SOCIAL_SOURCE = /^(instagram|ig|facebook|fb|whatsapp|wa|tiktok|twitter|x|pinterest|linkedin|snapchat|youtube|threads|telegram)$/;
const EMAIL = /(^|\.)(mail\.google|outlook\.live|mail\.yahoo|webmail)\./;

/** One bucket per landing, from the UTM tags first and the referring site second. */
export function channelFor(attr: Pick<VisitAttribution, "source" | "medium" | "referrer" | "campaign">): Channel {
  const medium = attr.medium.toLowerCase();
  const source = attr.source.toLowerCase();
  const referrer = attr.referrer.toLowerCase();

  if (medium) {
    if (/^(cpc|ppc|paid|paidsocial|paid-social|ads?|display|banner)$/.test(medium)) return "Paid";
    if (/^(email|e-mail|newsletter)$/.test(medium)) return "Email";
    if (/^(social|social-media|organic-social)$/.test(medium)) return "Social";
    if (medium === "organic") return "Search";
    if (medium === "referral") return "Referral";
  }
  if (source && source !== "(direct)" && source !== referrer) {
    if (SOCIAL_SOURCE.test(source)) return "Social";
    if (/^(email|newsletter)$/.test(source)) return "Email";
    return "Campaign";
  }
  if (referrer) {
    if (SEARCH.test(referrer)) return "Search";
    if (SOCIAL.test(referrer) || referrer === "l.instagram.com" || referrer === "lm.facebook.com") return "Social";
    if (EMAIL.test(referrer)) return "Email";
    return "Referral";
  }
  return "Direct";
}
