import crypto from "crypto";

const secret = process.env.FLUTTERWAVE_SECRET_KEY;

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
  if (!secret) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");

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
  if (!secret) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");

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
      meta?: { orderId?: string };
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

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!secret || !signature) return false;
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return hash === signature;
}
