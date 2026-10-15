import { getLogoSettingsSafe } from "@/lib/logos";
import { HOUSE_ADDRESS_ONE_LINE, loadHouseAddressOneLine } from "@/lib/house-address";
import { absolutePublicUrl } from "@/lib/app-url";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";

/**
 * Which house a message speaks for. Bespoke, consultations and the invoices
 * that come out of them are Prudential Atelier; ready-to-wear, accounts and
 * everything else is Prudent Gabriel.
 */
export type EmailBrand = "main" | "atelier";

/** Light mark for the choc header. */
export let emailLogoWhiteUrl = "";
/** Dark-coloured mark if a client inverts the header to a light field. */
export let emailLogoDarkUrl = "";
/** Atelier wordmark for the choc header (uploaded white variant, or the dark one whitened). */
export let emailAtelierLogoWhiteUrl = "";
/** Atelier wordmark as uploaded, for light fields. */
export let emailAtelierLogoDarkUrl = "";
/** Factory address for every customer footer. */
export let emailHouseAddress = HOUSE_ADDRESS_ONE_LINE;

/** The atelier mark is a 4:1 wordmark, not a square crest. */
export const EMAIL_ATELIER_LOGO_WIDTH = 200;
export const EMAIL_ATELIER_LOGO_HEIGHT = 50;

export const ATELIER_HOUSE_NAME = "PRUDENTIAL ATELIER";

/** Logos are stored as `/media/public/...`; a mail client has no origin to resolve that against. */
function forEmail(url: string): string {
  return url.trim() ? absolutePublicUrl(url) : "";
}

/**
 * Only a black atelier wordmark is usually uploaded, and black is unreadable on
 * the choc header. Cloudinary can recolour it to white on the fly.
 */
export function whitenCloudinaryLogo(url: string): string {
  if (!/res\.cloudinary\.com\/.+\/image\/upload\//.test(url)) return "";
  return url.replace("/image/upload/", "/image/upload/e_colorize:100,co_rgb:FFFFFF/");
}

export async function primeEmailBranding(): Promise<void> {
  const [{ logoWhite, logoDark, atelier }, address] = await Promise.all([
    getLogoSettingsSafe(),
    loadHouseAddressOneLine(),
  ]);
  emailLogoWhiteUrl = forEmail(logoWhite);
  emailLogoDarkUrl = forEmail(logoDark);
  emailAtelierLogoDarkUrl = forEmail(atelier.dark);
  emailAtelierLogoWhiteUrl = forEmail(atelier.white) || whitenCloudinaryLogo(emailAtelierLogoDarkUrl);
  emailHouseAddress = address;
}

export function emailHouseName(brand: EmailBrand): string {
  return brand === "atelier" ? ATELIER_HOUSE_NAME : CUSTOMER_HOUSE_NAME;
}
