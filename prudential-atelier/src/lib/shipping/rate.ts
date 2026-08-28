import { ShippingMarkupKind, type ShippingMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCarrier } from "@/lib/shipping/carriers";
import {
  CARRIER_TIMEOUT_MS,
  QUOTE_CACHE_TTL_MS,
  type RateError,
  type RateRequest,
  type RateResult,
} from "@/lib/shipping/carriers/types";

type CacheEntry = { at: number; result: RateResult | RateError };

const memoryCache = new Map<string, CacheEntry>();

function cacheKey(carrier: string, req: RateRequest): string {
  return [
    carrier,
    req.destination.country,
    req.destination.state,
    req.destination.city,
    req.billableKg.toFixed(2),
    req.lengthCm,
    req.widthCm,
    req.heightCm,
  ].join("|");
}

export function applyMarkup(amountNGN: number, method: Pick<ShippingMethod, "markupKind" | "markupValue">): number {
  const value = method.markupValue ?? 0;
  if (!value || value <= 0) return amountNGN;
  if (method.markupKind === ShippingMarkupKind.FLAT) return amountNGN + value;
  return amountNGN * (1 + value / 100);
}

export function applyMarkupForTest(amountNGN: number, kind: "PERCENT" | "FLAT" | null, value: number | null): number {
  return applyMarkup(amountNGN, {
    markupKind: kind === "FLAT" ? ShippingMarkupKind.FLAT : kind === "PERCENT" ? ShippingMarkupKind.PERCENT : null,
    markupValue: value,
  });
}

async function logRate(params: {
  carrier: string;
  request: RateRequest;
  result: RateResult | RateError;
  durationMs: number;
}): Promise<void> {
  try {
    await prisma.shippingRateLog.create({
      data: {
        carrier: params.carrier,
        request: params.request as object,
        response: params.result as object,
        durationMs: params.durationMs,
        outcome: params.result.ok ? "ok" : params.result.kind,
        error: params.result.ok ? null : params.result.message,
      },
    });
  } catch (e) {
    console.warn("[shipping-rate-log]", e);
  }
}

export async function rateWithTimeout(
  carrierName: "gig" | "dhl",
  req: RateRequest,
  method?: Pick<ShippingMethod, "markupKind" | "markupValue"> | null,
): Promise<RateResult | RateError> {
  const key = cacheKey(carrierName, req);
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_CACHE_TTL_MS) {
    return hit.result;
  }

  const carrier = getCarrier(carrierName);
  const started = Date.now();

  if (!carrier.isConfigured()) {
    const result: RateError = { ok: false, kind: "unconfigured", message: `${carrier.name} is not configured` };
    await logRate({ carrier: carrier.name, request: req, result, durationMs: Date.now() - started });
    memoryCache.set(key, { at: Date.now(), result });
    return result;
  }

  let result: RateResult | RateError;
  try {
    result = await Promise.race([
      carrier.rate(req),
      new Promise<RateError>((resolve) => {
        setTimeout(
          () => resolve({ ok: false, kind: "timeout", message: `${carrier.name} timed out` }),
          CARRIER_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (e) {
    result = { ok: false, kind: "error", message: e instanceof Error ? e.message : "rate failed" };
  }

  if (result.ok && method) {
    result = { ...result, amountNGN: Math.round(applyMarkup(result.amountNGN, method) * 100) / 100 };
  }

  await logRate({ carrier: carrier.name, request: req, result, durationMs: Date.now() - started });
  memoryCache.set(key, { at: Date.now(), result });
  return result;
}

export function clearShippingQuoteCacheForTest(): void {
  memoryCache.clear();
}
