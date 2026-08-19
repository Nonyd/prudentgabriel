import { getFlutterwaveSecret, getFlutterwaveWebhookHash } from "@/lib/payments/config";
import { timingSafeEqualString } from "@/lib/crypto-compare";

export interface FlutterwaveInitResult {
  paymentLink: string;
  txRef: string;
}

export async function initializeTransaction(params: {
  txRef: string;
  amount: number;
  currency: "NGN" | "USD" | "GBP";
  email: string;
  name: string;
  phone?: string;
  redirectUrl: string;
  meta: { orderId?: string; bookingId?: string };
}): Promise<FlutterwaveInitResult> {
  const secret = await getFlutterwaveSecret();
  if (!secret) throw new Error("Flutterwave secret key is not configured");

  const body = {
    tx_ref: params.txRef,
    amount: params.amount,
    currency: params.currency,
    redirect_url: params.redirectUrl,
    customer: {
      email: params.email,
      name: params.name,
      phonenumber: params.phone ?? "",
    },
    meta: params.meta,
  };

  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { link: string };
  };

  if (!res.ok || json.status !== "success" || !json.data?.link) {
    throw new Error(json.message ?? "Flutterwave initialize failed");
  }

  return { paymentLink: json.data.link, txRef: params.txRef };
}

export async function verifyTransaction(transactionId: string): Promise<{
  status: string;
  txRef: string;
  amount: number;
  currency: string;
  meta: { orderId?: string; bookingId?: string };
}> {
  const secret = await getFlutterwaveSecret();
  if (!secret) throw new Error("Flutterwave secret key is not configured");

  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const json = (await res.json()) as {
    status?: string;
    data?: {
      status: string;
      tx_ref: string;
      amount: number;
      currency: string;
      meta?: { orderId?: string; bookingId?: string };
    };
  };

  if (!res.ok || json.status !== "success" || !json.data) {
    throw new Error("Flutterwave verify failed");
  }

  const d = json.data;
  return {
    status: d.status,
    txRef: d.tx_ref,
    amount: d.amount,
    currency: d.currency,
    meta: d.meta ?? {},
  };
}

export async function verifyWebhookSignature(_rawBody: string, signature: string | null): Promise<boolean> {
  const expected = await getFlutterwaveWebhookHash();
  if (!expected || !signature) return false;
  return timingSafeEqualString(expected, signature);
}
