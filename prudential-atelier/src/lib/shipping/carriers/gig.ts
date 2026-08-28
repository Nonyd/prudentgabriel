import type { RateError, RateRequest, RateResult, ShippingCarrier } from "@/lib/shipping/carriers/types";

function env(key: string): string | null {
  const v = process.env[key];
  return v?.trim() ? v.trim() : null;
}

async function setting(key: string): Promise<string | null> {
  try {
    const { getSetting } = await import("@/lib/settings");
    const v = await getSetting(key);
    return v?.trim() ? v.trim() : null;
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
      const key = opts?.apiKey ?? env("GIG_API_KEY");
      const wallet = opts?.walletId ?? env("GIG_WALLET_ID");
      return Boolean(key && wallet);
    },
    async rate(req: RateRequest): Promise<RateResult | RateError> {
      const apiKey = opts?.apiKey ?? env("GIG_API_KEY") ?? (await setting("gig_api_key"));
      const wallet = opts?.walletId ?? env("GIG_WALLET_ID") ?? (await setting("gig_wallet_id"));
      const base = env("GIG_API_BASE") ?? "https://gigl-api.giglogistics.com";
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
