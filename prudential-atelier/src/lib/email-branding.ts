import { getLogoSettingsSafe } from "@/lib/logos";
import { HOUSE_ADDRESS_ONE_LINE, loadHouseAddressOneLine } from "@/lib/house-address";
import { absolutePublicUrl } from "@/lib/app-url";

/** Light mark for the choc header. */
export let emailLogoWhiteUrl = "";
/** Dark-coloured mark if a client inverts the header to a light field. */
export let emailLogoDarkUrl = "";
/** Factory address for every customer footer. */
export let emailHouseAddress = HOUSE_ADDRESS_ONE_LINE;

/** Logos are stored as `/media/public/...`; a mail client has no origin to resolve that against. */
function forEmail(url: string): string {
  return url.trim() ? absolutePublicUrl(url) : "";
}

export async function primeEmailBranding(): Promise<void> {
  const [{ logoWhite, logoDark }, address] = await Promise.all([
    getLogoSettingsSafe(),
    loadHouseAddressOneLine(),
  ]);
  emailLogoWhiteUrl = forEmail(logoWhite);
  emailLogoDarkUrl = forEmail(logoDark);
  emailHouseAddress = address;
}
