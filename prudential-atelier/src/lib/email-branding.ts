import { getLogoSettingsSafe } from "@/lib/logos";

/** Light mark for the choc header. */
export let emailLogoWhiteUrl = "";
/** Dark-coloured mark if a client inverts the header to a light field. */
export let emailLogoDarkUrl = "";

export async function primeEmailBranding(): Promise<void> {
  const { logoWhite, logoDark } = await getLogoSettingsSafe();
  emailLogoWhiteUrl = logoWhite;
  emailLogoDarkUrl = logoDark;
}
