import { isLagosState } from "@/lib/geo/nigeria-states";

export type DestinationBand = "LAGOS" | "NIGERIA" | "INTERNATIONAL";

export type DestinationInput = {
  country: string;
  state?: string | null;
  city?: string | null;
};

export function countryIsNigeria(country: string | null | undefined): boolean {
  const c = (country ?? "").trim().toUpperCase();
  return c === "NG" || c === "NGA" || c === "NIGERIA";
}

export function resolveDestinationBand(input: DestinationInput): DestinationBand {
  if (!countryIsNigeria(input.country)) return "INTERNATIONAL";
  const state = input.state ?? "";
  const city = input.city ?? "";
  if (isLagosState(state) || isLagosState(city)) return "LAGOS";
  return "NIGERIA";
}
