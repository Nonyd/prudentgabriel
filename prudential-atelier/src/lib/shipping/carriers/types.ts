export type RateRequest = {
  destination: {
    country: string;
    state: string;
    city: string;
    postalCode?: string;
  };
  actualKg: number;
  billableKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  declaredValueNGN: number;
};

export type RateResult = {
  ok: true;
  amountNGN: number;
  currency: "NGN" | "USD";
  service: string;
  etaText: string;
  raw?: unknown;
};

export type RateError = {
  ok: false;
  kind: "unconfigured" | "timeout" | "error";
  message: string;
};

export interface ShippingCarrier {
  name: string;
  isConfigured(): boolean;
  rate(req: RateRequest): Promise<RateResult | RateError>;
}

export const CARRIER_TIMEOUT_MS = 6_000;
export const QUOTE_CACHE_TTL_MS = 10 * 60 * 1000;
