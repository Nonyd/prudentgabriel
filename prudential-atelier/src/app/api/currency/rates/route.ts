import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/currency";

export const revalidate = 3600;

export async function GET() {
  try {
    const rates = await getExchangeRates();
    return NextResponse.json(
      { NGN: rates.NGN, USD: rates.USD, GBP: rates.GBP },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json(
      { NGN: 1580, USD: 1, GBP: 0.79 },
      { headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  }
}
