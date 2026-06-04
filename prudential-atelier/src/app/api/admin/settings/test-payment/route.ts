import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  getFlutterwaveSecret,
  getMonnifyApiKey,
  getMonnifyBaseUrl,
  getMonnifyContractCode,
  getMonnifySecret,
  getPaystackSecret,
  getStripeSecret,
} from "@/lib/payments/config";

const bodySchema = z.object({
  gateway: z.enum(["paystack", "flutterwave", "stripe", "monnify"]),
});

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { gateway } = parsed.data;

  try {
    if (gateway === "paystack") {
      const secret = await getPaystackSecret();
      if (!secret) {
        return NextResponse.json({ ok: false, message: "Paystack secret key not configured" });
      }
      const res = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=1", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = (await res.json()) as { status?: boolean; message?: string };
      if (!res.ok || !data.status) {
        return NextResponse.json({
          ok: false,
          message: data.message ?? `HTTP ${res.status}`,
        });
      }
      return NextResponse.json({ ok: true, message: "Paystack credentials accepted" });
    }

    if (gateway === "flutterwave") {
      const secret = await getFlutterwaveSecret();
      if (!secret) {
        return NextResponse.json({ ok: false, message: "Flutterwave secret key not configured" });
      }
      const res = await fetch("https://api.flutterwave.com/v3/balances", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = (await res.json()) as { status?: string; message?: string };
      if (!res.ok || data.status !== "success") {
        return NextResponse.json({
          ok: false,
          message: data.message ?? `HTTP ${res.status}`,
        });
      }
      return NextResponse.json({ ok: true, message: "Flutterwave credentials accepted" });
    }

    if (gateway === "stripe") {
      const secret = await getStripeSecret();
      if (!secret) {
        return NextResponse.json({ ok: false, message: "Stripe secret key not configured" });
      }
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({
          ok: false,
          message: (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
        });
      }
      return NextResponse.json({ ok: true, message: "Stripe credentials accepted" });
    }

    const apiKey = await getMonnifyApiKey();
    const secret = await getMonnifySecret();
    const contract = await getMonnifyContractCode();
    if (!apiKey || !secret || !contract) {
      return NextResponse.json({ ok: false, message: "Monnify API key, secret, and contract code are required" });
    }
    const baseUrl = await getMonnifyBaseUrl();
    const auth = Buffer.from(`${apiKey}:${secret}`).toString("base64");
    const res = await fetch(
      `${baseUrl}/api/v1/disbursements/wallet/balance?accountReference=${encodeURIComponent(contract)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    const data = (await res.json()) as { requestSuccessful?: boolean; responseMessage?: string };
    if (!res.ok || !data.requestSuccessful) {
      return NextResponse.json({
        ok: false,
        message: data.responseMessage ?? `HTTP ${res.status}`,
      });
    }
    return NextResponse.json({ ok: true, message: "Monnify credentials accepted" });
  } catch (e) {
    console.error("[test-payment]", e);
    return NextResponse.json({ ok: false, message: "Connection test failed" }, { status: 500 });
  }
}
