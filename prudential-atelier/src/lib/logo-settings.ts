import type { SubBrand } from "@/lib/sub-brand";

export type SubBrandLogos = {
  dark: string;
  white: string;
};

export type LogoSettings = {
  logoDark: string;
  logoWhite: string;
  atelier: SubBrandLogos;
  bridal: SubBrandLogos;
  kids: SubBrandLogos;
};

export const LOGO_SETTING_KEYS = [
  "logo_dark",
  "logo_white",
  "logo_atelier_dark",
  "logo_atelier_white",
  "logo_bridal_dark",
  "logo_bridal_white",
  "logo_kids_dark",
  "logo_kids_white",
] as const;

export function resolveSubBrandLogo(
  settings: LogoSettings,
  subBrand: SubBrand,
  variant: "dark" | "white",
): string {
  if (subBrand === "main") {
    return variant === "dark" ? settings.logoDark : settings.logoWhite;
  }

  const brand = settings[subBrand];
  const subUrl = variant === "dark" ? brand.dark : brand.white;
  if (subUrl) return subUrl;

  return variant === "dark" ? settings.logoDark : settings.logoWhite;
}
