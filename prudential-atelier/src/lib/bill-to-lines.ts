/**
 * Bill-to on the client document is the person, then an address if we have one.
 * Never the first line item — that was the AL walk finding.
 */
export function billToDisplayLines(params: {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
}): string[] {
  const lines: string[] = [];
  const name = params.name.trim();
  if (name) lines.push(name);
  const address = params.address?.trim() ?? "";
  if (address) lines.push(address);
  const city = params.city?.trim() ?? "";
  const country = params.country?.trim() ?? "";
  if (address || city) {
    const loc = [city, country].filter(Boolean).join(", ");
    if (loc) lines.push(loc);
  }
  const phone = params.phone?.trim() ?? "";
  if (phone) lines.push(phone);
  return lines;
}

export function billToOmitsLineItem(billToLines: string[], lineItemDescription: string | null | undefined): boolean {
  const piece = lineItemDescription?.trim();
  if (!piece) return true;
  return !billToLines.slice(1).some((line) => line === piece);
}
