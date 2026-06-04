import { unstable_cache } from "next/cache";
import { getSetting } from "@/lib/settings";

export type LogoSettings = {
  logoDark: string;
  logoWhite: string;
};

async function fetchLogoSettings(): Promise<LogoSettings> {
  const [logoDark, logoWhite] = await Promise.all([
    getSetting("logo_dark"),
    getSetting("logo_white"),
  ]);
  return {
    logoDark: logoDark?.trim() ?? "",
    logoWhite: logoWhite?.trim() ?? "",
  };
}

export const getLogoSettings = unstable_cache(fetchLogoSettings, ["logo-settings"], {
  revalidate: 3600,
  tags: ["logo-settings"],
});

export const LOGO_SETTING_KEYS = ["logo_dark", "logo_white"] as const;
