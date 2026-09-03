import type { RateError, RateRequest, RateResult, ShippingCarrier } from "@/lib/shipping/carriers/types";
import { getDashboardSecret } from "@/lib/credential-catalog";

async function setting(key: string): Promise<string | null> {
  try {
    return await getDashboardSecret(key);
  } catch {
    return null;
  }
}

export function createDhlCarrier(opts?: {
  siteId?: string | null;
  password?: string | null;
  accountNumber?: string | null;
}): ShippingCarrier {
  return {
    name: "dhl",
    isConfigured() {
      if (opts) return Boolean(opts.siteId?.trim() && opts.password?.trim() && opts.accountNumber?.trim());
      return true;
    },
    async rate(req: RateRequest): Promise<RateResult | RateError> {
      const siteId = opts?.siteId?.trim() || (await setting("dhl_site_id"));
      const password = opts?.password?.trim() || (await setting("dhl_password"));
      const account = opts?.accountNumber?.trim() || (await setting("dhl_account_number"));
      const base = process.env.DHL_API_BASE?.trim() || "https://express.api.dhl.com/mydhlapi";
      if (!siteId || !password || !account) {
        return { ok: false, kind: "unconfigured", message: "DHL Express account is not configured" };
      }
      const auth = Buffer.from(`${siteId}:${password}`).toString("base64");
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/rates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            customerDetails: {
              shipperDetails: {
                postalCode: "101211",
                cityName: "Lagos",
                countryCode: "NG",
              },
              receiverDetails: {
                postalCode: req.destination.postalCode ?? "",
                cityName: req.destination.city,
                countryCode: req.destination.country,
              },
            },
            accounts: [{ typeCode: "shipper", number: account }],
            productCode: "P",
            plannedShippingDateAndTime: new Date().toISOString(),
            unitOfMeasurement: "metric",
            isCustomsDeclarable: req.destination.country.toUpperCase() !== "NG",
            monetaryAmount: [{ typeCode: "declaredValue", value: req.declaredValueNGN, currency: "NGN" }],
            packages: [
              {
                weight: req.billableKg,
                dimensions: {
                  length: req.lengthCm,
                  width: req.widthCm,
                  height: req.heightCm,
                },
              },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { ok: false, kind: "error", message: `DHL HTTP ${res.status} ${text}`.trim() };
        }
        const data = (await res.json()) as {
          products?: Array<{
            productName?: string;
            totalPrice?: Array<{ price?: number; priceCurrency?: string }>;
            deliveryCapabilities?: { estimatedDeliveryDateAndTime?: string };
          }>;
        };
        const product = data.products?.[0];
        const price = product?.totalPrice?.[0];
        const amount = Number(price?.price);
        if (!Number.isFinite(amount) || amount < 0) {
          return { ok: false, kind: "error", message: "DHL returned no rate" };
        }
        const currency = price?.priceCurrency === "USD" ? "USD" : "NGN";
        let amountNGN = amount;
        if (currency === "USD") {
          const { getLockedFx } = await import("@/lib/fx");
          const fx = await getLockedFx();
          amountNGN = fx.rate > 0 ? amount / fx.rate : amount * 1500;
        }
        return {
          ok: true,
          amountNGN,
          currency: "NGN",
          service: product?.productName ?? "EXPRESS WORLDWIDE",
          etaText: "3–7 business days",
          raw: data,
        };
      } catch (e) {
        return { ok: false, kind: "error", message: e instanceof Error ? e.message : "DHL rate failed" };
      }
    },
  };
}
