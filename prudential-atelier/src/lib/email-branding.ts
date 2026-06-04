import { getLogoSettings } from "@/lib/logos";

/** Set before rendering react-email templates in the same request. */
export let emailLogoWhiteUrl = "";

export async function primeEmailBranding(): Promise<void> {
  const { logoWhite } = await getLogoSettings();
  emailLogoWhiteUrl = logoWhite;
}
