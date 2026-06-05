import { unstable_cache } from "next/cache";
import { getSetting } from "@/lib/settings";
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

async function fetchLogoSettings(): Promise<LogoSettings> {
  const keys = [
    "logo_dark",
    "logo_white",
    "logo_atelier_dark",
    "logo_atelier_white",
    "logo_bridal_dark",
    "logo_bridal_white",
    "logo_kids_dark",
    "logo_kids_white",
    // Legacy single-image keys — used as dark variant fallback
    "img_logo_atelier",
    "img_logo_bridal",
    "img_logo_kids",
  ] as const;

  const values = await Promise.all(keys.map((k) => getSetting(k)));
  const map = Object.fromEntries(keys.map((k, i) => [k, values[i]?.trim() ?? ""])) as Record<
    (typeof keys)[number],
    string
  >;

  return {
    logoDark: map.logo_dark,
    logoWhite: map.logo_white,
    atelier: {
      dark: map.logo_atelier_dark || map.img_logo_atelier,
      white: map.logo_atelier_white,
    },
    bridal: {
      dark: map.logo_bridal_dark || map.img_logo_bridal,
      white: map.logo_bridal_white,
    },
    kids: {
      dark: map.logo_kids_dark || map.img_logo_kids,
      white: map.logo_kids_white,
    },
  };
}

export const getLogoSettings = unstable_cache(fetchLogoSettings, ["logo-settings"], {
  revalidate: 3600,
  tags: ["logo-settings"],
});

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
