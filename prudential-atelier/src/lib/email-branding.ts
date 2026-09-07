import { getLogoSettingsSafe } from "@/lib/logos";
import { HOUSE_ADDRESS_ONE_LINE, loadHouseAddressOneLine } from "@/lib/house-address";

/** Light mark for the choc header. */
export let emailLogoWhiteUrl = "";
/** Dark-coloured mark if a client inverts the header to a light field. */
export let emailLogoDarkUrl = "";
/** Factory address for every customer footer. */
export let emailHouseAddress = HOUSE_ADDRESS_ONE_LINE;

export async function primeEmailBranding(): Promise<void> {
  const [{ logoWhite, logoDark }, address] = await Promise.all([
    getLogoSettingsSafe(),
    loadHouseAddressOneLine(),
  ]);
  emailLogoWhiteUrl = logoWhite;
  emailLogoDarkUrl = logoDark;
  emailHouseAddress = address;
}
