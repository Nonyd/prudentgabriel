import { injectedShippingCarriersForTest } from "@/lib/shipping/carriers";
import {
  SHIPPING_MODE_INTERNATIONAL_KEY,
  SHIPPING_MODE_NIGERIA_KEY,
} from "@/lib/shipping/copy";

export type ShippingBandMode = "MANUAL" | "LIVE";

export type ShippingBandModes = {
  nigeria: ShippingBandMode;
  international: ShippingBandMode;
};

export type BandAdminStatus = {
  mode: "AUTOMATIC" | "MANUAL" | "LIVE";
  /** Null for Lagos — no carrier account. */
  configured: boolean | null;
  /** LIVE with no credentials. MANUAL is never this. */
  misconfigured: boolean;
};

export const KNOWN_QUOTE_CARRIERS = ["DHL", "GIG", "Kwik", "ABC", "FedEx", "UPS"] as const;

let testModes: ShippingBandModes | null = null;

export function setShippingBandModesForTest(modes: ShippingBandModes | null): void {
  testModes = modes;
}

function parseMode(raw: string | null | undefined, fallback: ShippingBandMode): ShippingBandMode {
  const v = raw?.trim().toUpperCase();
  if (v === "LIVE" || v === "MANUAL") return v;
  return fallback;
}

export async function getShippingBandModes(): Promise<ShippingBandModes> {
  if (testModes) return testModes;
  const { getSetting } = await import("@/lib/settings");
  const [nigeria, international] = await Promise.all([
    getSetting(SHIPPING_MODE_NIGERIA_KEY),
    getSetting(SHIPPING_MODE_INTERNATIONAL_KEY),
  ]);
  return {
    nigeria: parseMode(nigeria, "MANUAL"),
    international: parseMode(international, "MANUAL"),
  };
}

async function settingPresent(key: string): Promise<boolean> {
  try {
    const { getDashboardSecret } = await import("@/lib/credential-catalog");
    const v = await getDashboardSecret(key);
    return Boolean(v);
  } catch {
    return false;
  }
}

function injectedConfigured(name: "gig" | "dhl"): boolean | null {
  const injected = injectedShippingCarriersForTest();
  if (!injected) return null;
  return Boolean(injected.find((c) => c.name === name)?.isConfigured());
}

async function gigCredentialsPresent(): Promise<boolean> {
  const injected = injectedConfigured("gig");
  if (injected != null) return injected;
  const [key, wallet] = await Promise.all([settingPresent("gig_api_key"), settingPresent("gig_wallet_id")]);
  return Boolean(key && wallet);
}

async function dhlCredentialsPresent(): Promise<boolean> {
  const injected = injectedConfigured("dhl");
  if (injected != null) return injected;
  const [site, password, account] = await Promise.all([
    settingPresent("dhl_site_id"),
    settingPresent("dhl_password"),
    settingPresent("dhl_account_number"),
  ]);
  return Boolean(site && password && account);
}

export async function getShippingAdminStatus(): Promise<{
  lagos: BandAdminStatus;
  nigeria: BandAdminStatus;
  international: BandAdminStatus;
}> {
  const modes = await getShippingBandModes();
  const [gigOk, dhlOk] = await Promise.all([gigCredentialsPresent(), dhlCredentialsPresent()]);
  return {
    lagos: { mode: "AUTOMATIC", configured: null, misconfigured: false },
    nigeria: {
      mode: modes.nigeria,
      configured: gigOk,
      misconfigured: modes.nigeria === "LIVE" && !gigOk,
    },
    international: {
      mode: modes.international,
      configured: dhlOk,
      misconfigured: modes.international === "LIVE" && !dhlOk,
    },
  };
}
