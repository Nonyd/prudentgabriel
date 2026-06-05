export type SubBrand = "main" | "atelier" | "bridal" | "kids";

export function getSubBrand(pathname: string): SubBrand {
  if (pathname.startsWith("/bridal")) return "bridal";
  if (pathname.startsWith("/kids")) return "kids";
  if (pathname.startsWith("/atelier")) return "atelier";
  return "main";
}

const INSTAGRAM_KEY: Record<SubBrand, string> = {
  main: "social_instagram",
  atelier: "social_instagram_atelier",
  bridal: "social_instagram_bridal",
  kids: "social_instagram_kids",
};

const INSTAGRAM_FALLBACK: Record<SubBrand, string> = {
  main: "@prudentgabriel",
  atelier: "@prudential_atelier",
  bridal: "@prudential_bridal",
  kids: "@prudential_kids",
};

export function getInstagramSettingKey(subBrand: SubBrand): string {
  return INSTAGRAM_KEY[subBrand];
}

export function getInstagramFallback(subBrand: SubBrand): string {
  return INSTAGRAM_FALLBACK[subBrand];
}

export function instagramHandleToUrl(handle: string): string {
  const username = handle.replace(/^@/, "").trim();
  return `https://instagram.com/${username}`;
}
