/** Lagos factory — customer-facing. Old Surulere copy is treated as stale. */

export const HOUSE_ADDRESS_LINE_1 = "No. 4 Akinwale Shitu Divine Homes, Thomas Estates";
export const HOUSE_ADDRESS_LINE_2 = "Ajah, Lagos, Nigeria";
export const HOUSE_ADDRESS_ONE_LINE = `${HOUSE_ADDRESS_LINE_1}, ${HOUSE_ADDRESS_LINE_2}`;
export const HOUSE_MAPS_QUERY = "Akinwale Shitu Divine Homes Thomas Estates Ajah Lagos";
export const HOUSE_MAPS_LINK = `https://maps.google.com/?q=${encodeURIComponent(HOUSE_MAPS_QUERY)}`;
export const HOUSE_MAPS_EMBED = `https://maps.google.com/maps?q=${encodeURIComponent(HOUSE_MAPS_QUERY)}&output=embed`;

function isStaleAddress(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v) return true;
  return /bode\s*thomas|surulere/i.test(v);
}

export function resolveHouseAddressLine1(raw?: string | null): string {
  const v = raw?.trim();
  if (!v || isStaleAddress(v)) return HOUSE_ADDRESS_LINE_1;
  return v;
}

export function resolveHouseAddressLine2(raw?: string | null): string {
  const v = raw?.trim();
  if (!v || isStaleAddress(v)) return HOUSE_ADDRESS_LINE_2;
  return v;
}

export function resolveHouseAddressBlock(raw?: string | null): string {
  const v = raw?.trim();
  if (!v || isStaleAddress(v)) return `${HOUSE_ADDRESS_LINE_1}\n${HOUSE_ADDRESS_LINE_2}`;
  return v;
}

export function resolveHouseMapsLink(raw?: string | null): string {
  const v = raw?.trim();
  if (!v || /surulere/i.test(v)) return HOUSE_MAPS_LINK;
  return v;
}

export function resolvePickupName(raw?: string | null): string {
  const v = raw?.trim() ?? "";
  if (!v || /surulere/i.test(v)) return "Ajah factory";
  return v;
}

export function resolvePickupAddress(raw?: string | null): string {
  return resolveHouseAddressBlock(raw).replace(/\n/g, ", ");
}

export function resolveHouseMapsEmbed(raw?: string | null): string {
  const v = raw?.trim();
  if (!v || /surulere/i.test(v)) return HOUSE_MAPS_EMBED;
  return v;
}

export async function loadHouseAddressOneLine(): Promise<string> {
  try {
    const { getCMSContent, cmsGet } = await import("@/lib/cms");
    const cms = await getCMSContent(["contact_lagos_address_1", "contact_lagos_address_2"]);
    const line1 = resolveHouseAddressLine1(cmsGet(cms, "contact_lagos_address_1", ""));
    const line2 = resolveHouseAddressLine2(cmsGet(cms, "contact_lagos_address_2", ""));
    return `${line1}, ${line2}`;
  } catch {
    return HOUSE_ADDRESS_ONE_LINE;
  }
}
