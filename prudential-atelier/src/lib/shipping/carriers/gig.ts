import type { RateError, RateRequest, RateResult, ShippingCarrier } from "@/lib/shipping/carriers/types";
import { getDashboardSecret } from "@/lib/credential-catalog";

async function setting(key: string): Promise<string | null> {
  try {
    return await getDashboardSecret(key);
  } catch {
    return null;
  }
}

export function createGigCarrier(opts?: {
  apiKey?: string | null;
  walletId?: string | null;
}): ShippingCarrier {
  return {
    name: "gig",
    isConfigured() {
      if (opts) return Boolean(opts.apiKey?.trim() && opts.walletId?.trim());
      return true;
    },
    async rate(req: RateRequest): Promise<RateResult | RateError> {
      const apiKey = opts?.apiKey?.trim() || (await setting("gig_api_key"));
      const wallet = opts?.walletId?.trim() || (await setting("gig_wallet_id"));
      const base = process.env.GIG_API_BASE?.trim() || "https://gigl-api.giglogistics.com";
      if (!apiKey || !wallet) {
        return { ok: false, kind: "unconfigured", message: "GIG corporate wallet is not configured" };
      }
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/rates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            walletId: wallet,
            destination: req.destination,
            weightKg: req.billableKg,
            dimensions: {
              lengthCm: req.lengthCm,
              widthCm: req.widthCm,
              heightCm: req.heightCm,
            },
            declaredValueNGN: req.declaredValueNGN,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return { ok: false, kind: "error", message: `GIG HTTP ${res.status} ${text}`.trim() };
        }
        const data = (await res.json()) as {
          amountNGN?: number;
          amount?: number;
          service?: string;
          etaText?: string;
          estimatedDays?: string;
        };
        const amount = Number(data.amountNGN ?? data.amount);
        if (!Number.isFinite(amount) || amount < 0) {
          return { ok: false, kind: "error", message: "GIG returned no rate" };
        }
        return {
          ok: true,
          amountNGN: amount,
          currency: "NGN",
          service: data.service ?? "standard",
          etaText: data.etaText ?? data.estimatedDays ?? "3–6 business days",
          raw: data,
        };
      } catch (e) {
        return { ok: false, kind: "error", message: e instanceof Error ? e.message : "GIG rate failed" };
      }
    },
  };
}
