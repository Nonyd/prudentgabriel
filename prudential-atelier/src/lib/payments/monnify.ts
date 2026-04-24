import crypto from "crypto";

const apiKey = process.env.MONNIFY_API_KEY;
const secretKey = process.env.MONNIFY_SECRET_KEY;
const contractCode = process.env.MONNIFY_CONTRACT_CODE;
const baseUrl = (process.env.MONNIFY_BASE_URL ?? "https://api.monnify.com").replace(/\/$/, "");

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getMonnifyToken(): Promise<string> {
  if (!apiKey || !secretKey) throw new Error("Monnify API credentials are not configured");

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });

  const json = (await res.json()) as {
    requestSuccessful?: boolean;
    responseMessage?: string;
    responseBody?: { accessToken?: string; expiresIn?: number };
  };

  if (!res.ok || !json.requestSuccessful || !json.responseBody?.accessToken) {
    throw new Error(json.responseMessage ?? "Monnify auth failed");
  }

  const ttlMs = (json.responseBody.expiresIn ?? 3600) * 1000;
  cachedToken = {
    token: json.responseBody.accessToken,
    expiresAt: now + Math.min(ttlMs, 50 * 60 * 1000),
  };
  return cachedToken.token;
}

export async function initializeTransaction(params: {
  amountNGN: number;
  reference: string;
  customerEmail: string;
  customerName: string;
  description: string;
  redirectUrl: string;
}): Promise<{ checkoutUrl: string; transactionReference: string }> {
  if (!contractCode) throw new Error("MONNIFY_CONTRACT_CODE is not configured");

  const token = await getMonnifyToken();
  const res = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountNGN,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      paymentDescription: params.description,
      currencyCode: "NGN",
      contractCode,
      paymentReference: params.reference,
      redirectUrl: params.redirectUrl,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD"],
    }),
  });

  const json = (await res.json()) as {
    requestSuccessful?: boolean;
    responseMessage?: string;
    responseBody?: { checkoutUrl?: string; transactionReference?: string };
  };

  if (!res.ok || !json.requestSuccessful || !json.responseBody?.checkoutUrl) {
    throw new Error(json.responseMessage ?? "Monnify init failed");
  }

  return {
    checkoutUrl: json.responseBody.checkoutUrl,
    transactionReference: json.responseBody.transactionReference ?? params.reference,
  };
}

export async function verifyTransaction(paymentReference: string): Promise<{
  status: string;
  amountPaid: number;
  paymentReference: string;
}> {
  const token = await getMonnifyToken();
  const url = `${baseUrl}/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(paymentReference)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = (await res.json()) as {
    requestSuccessful?: boolean;
    responseMessage?: string;
    responseBody?: { paymentStatus?: string; amountPaid?: number; paymentReference?: string };
  };

  if (!res.ok || !json.requestSuccessful || !json.responseBody) {
    throw new Error(json.responseMessage ?? "Monnify verify failed");
  }

  const b = json.responseBody;
  return {
    status: b.paymentStatus ?? "UNKNOWN",
    amountPaid: b.amountPaid ?? 0,
    paymentReference: b.paymentReference ?? paymentReference,
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!secretKey || !signature) return false;
  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return hash === signature;
}
