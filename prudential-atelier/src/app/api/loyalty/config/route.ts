import { NextResponse } from "next/server";
import { getMinRedemptionPoints, getPointRateNGN } from "@/lib/points";
import { ensureLoyaltySettingKeys } from "@/lib/loyalty-settings-bootstrap";

export const revalidate = 0;

export async function GET() {
  await ensureLoyaltySettingKeys();
  const [rateNGN, minRedemption] = await Promise.all([getPointRateNGN(), getMinRedemptionPoints()]);
  return NextResponse.json(
    { rateNGN, minRedemption },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
