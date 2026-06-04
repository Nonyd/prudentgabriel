import { NextResponse } from "next/server";
import { getPublicPaymentConfig } from "@/lib/payments/config";

export const revalidate = 60;

export async function GET() {
  try {
    const config = await getPublicPaymentConfig();
    return NextResponse.json(config, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("[payments/public-config]", e);
    return NextResponse.json({ error: "Failed to load payment config" }, { status: 500 });
  }
}
