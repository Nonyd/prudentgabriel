import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/settings";
import { logServerError } from "@/lib/logger";

export const revalidate = 300;

export async function GET() {
  try {
    const settings = await getPublicSettings();
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    await logServerError({ errorType: "PUBLIC_SETTINGS", error: e });
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}
