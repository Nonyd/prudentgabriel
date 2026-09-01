import crypto from "crypto";
import { getPaystackSecret } from "@/lib/payments/config";
import { timingSafeEqualString } from "@/lib/crypto-compare";
import { parseJsonResponse } from "@/lib/http/read-json";

export interface PaystackInitResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<PaystackInitResult> {
  const secret = await getPaystackSecret();
  if (!secret) throw new Error("Paystack secret key is not configured");

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const json = await parseJsonResponse<{
    status?: boolean;
    message?: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  }>(res, "Paystack");

  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message ?? "Paystack initialize failed");
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  reference: string;
  metadata: Record<string, string | undefined>;
}> {
  const secret = await getPaystackSecret();
  if (!secret) throw new Error("Paystack secret key is not configured");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const json = await parseJsonResponse<{
    status?: boolean;
    message?: string;
    data?: {
      status: string;
      amount: number;
      currency?: string;
      reference: string;
      metadata?: Record<string, string | undefined>;
    };
  }>(res, "Paystack");

  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message ?? "Paystack verify failed");
  }

  return {
    status: json.data.status,
    amount: json.data.amount,
    currency: json.data.currency ?? "NGN",
    reference: json.data.reference,
    metadata: (json.data.metadata ?? {}) as Record<string, string | undefined>,
  };
}

export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = await getPaystackSecret();
  if (!secret || !signature) return false;
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return timingSafeEqualString(hash, signature);
}
