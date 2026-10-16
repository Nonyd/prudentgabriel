import { NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/recent-activity";

export async function GET() {
  try {
    const items = await getRecentActivity();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch (e) {
    console.warn("[recent-activity]", e);
    return NextResponse.json({ items: [] });
  }
}
