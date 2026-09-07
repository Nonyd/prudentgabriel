import { NextRequest, NextResponse } from "next/server";
import { getPublicPaymentConfig } from "@/lib/payments/config";
import { parseBusinessLine } from "@/lib/payments/bank-account";
import { logServerError } from "@/lib/logger";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const line = parseBusinessLine(req.nextUrl.searchParams.get("line")) ?? "RTW";
    const config = await getPublicPaymentConfig(line);
    return NextResponse.json(config, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    await logServerError({ errorType: "PUBLIC_PAYMENT_CONFIG", error: e });
    return NextResponse.json({ error: "Failed to load payment config" }, { status: 500 });
  }
}
