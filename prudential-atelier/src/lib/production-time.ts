import { getSetting } from "@/lib/settings";
import { CUSTOM_SETTING_KEYS } from "@/lib/custom-settings";
import { FABRIC_PROMISE_HOURS } from "@/lib/fabric-unavailable";

export const PRODUCTION_COPY_KEY = "rtw_production_copy";
export const DEFAULT_PRODUCTION_COPY = "7-12 days";
export const DEFAULT_PRODUCTION_LEAD_DAYS = 12;

export const STANDARD_SIZE_COPY =
  "Cut to the house chart in your size. Returnable because another woman can wear a standard size.";

export const MADE_TO_MEASURE_REASON =
  "Cut to the measurements you entered. It cannot be returned for a change of mind, because a piece made to your body cannot be worn by someone else.";

export const FABRIC_POLICY_COPY = `If the fabric for your piece is unavailable, we will offer an alternative or a refund within ${FABRIC_PROMISE_HOURS} hours.`;

export function normalizeProductionCopy(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return DEFAULT_PRODUCTION_COPY;
  return t.replace(/–/g, "-");
}

export function productionLeadDaysFromCopy(copy: string): number {
  const nums = copy.match(/\d+/g)?.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0) ?? [];
  if (!nums.length) return DEFAULT_PRODUCTION_LEAD_DAYS;
  return Math.max(...nums);
}

export function madeThenShippedCopy(copy = DEFAULT_PRODUCTION_COPY): string {
  const c = normalizeProductionCopy(copy);
  const body = c.toLowerCase().includes("day") ? c : `${c} days`;
  return `Made in ${body}, then shipped.`;
}

export async function getProductionCopy(): Promise<string> {
  return normalizeProductionCopy(await getSetting(PRODUCTION_COPY_KEY));
}

export async function getProductionLeadDays(): Promise<number> {
  const [copy, custom] = await Promise.all([
    getProductionCopy(),
    getSetting(CUSTOM_SETTING_KEYS.leadTimeDays),
  ]);
  const fromCustom = Number(custom);
  if (Number.isFinite(fromCustom) && fromCustom > 0) return Math.round(fromCustom);
  return productionLeadDaysFromCopy(copy);
}
