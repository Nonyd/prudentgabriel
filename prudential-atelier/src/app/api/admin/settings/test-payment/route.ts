import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";

const bodySchema = z.object({
  gateway: z.enum(["paystack", "flutterwave", "stripe", "monnify"]),
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { gateway } = parsed.data;

  try {
    if (gateway === "paystack") {
      const { paystack_secret_key: secret } = await getSettings("PAYMENTS");
      if (!secret?.trim()) {
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
      const { flutterwave_secret_key: secret } = await getSettings("PAYMENTS");
      if (!secret?.trim()) {
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
      const { stripe_secret_key: secret } = await getSettings("PAYMENTS");
      if (!secret?.trim()) {
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

    const { monnify_api_key: apiKey, monnify_secret_key: secret, monnify_contract_code: contract } =
      await getSettings("PAYMENTS");
    if (!apiKey?.trim() || !secret?.trim() || !contract?.trim()) {
      return NextResponse.json({ ok: false, message: "Monnify API key, secret, and contract code are required" });
    }
    const auth = Buffer.from(`${apiKey}:${secret}`).toString("base64");
    const res = await fetch(
      `${process.env.MONNIFY_BASE_URL ?? "https://api.monnify.com"}/api/v1/disbursements/wallet/balance?accountReference=${encodeURIComponent(contract)}`,
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
