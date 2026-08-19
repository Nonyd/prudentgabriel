import { NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/auth-google";

export const revalidate = 60;

export async function GET() {
  return NextResponse.json(
    { google: isGoogleOAuthConfigured() },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } },
  );
}
