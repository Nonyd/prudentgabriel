import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { buildTrafficReport, parseTrafficRange } from "@/lib/analytics/traffic";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("reports");
  if (!gate.ok) return gate.response;
  const range = parseTrafficRange(req.nextUrl.searchParams.get("range"));
  const report = await buildTrafficReport(range);
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
