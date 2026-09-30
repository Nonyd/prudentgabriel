import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { groupClientsByPlace, loadClientPlaceRows } from "@/lib/client-places";
import { logError } from "@/lib/logger";

/**
 * Slice BC4 — clients counted by country, state and city. Counts only: no
 * names, no addresses, no map. Read-only, behind `clients` or `reports`.
 */
export async function GET() {
  const gate = await requireAdminApi(["clients", "reports"]);
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json(groupClientsByPlace(await loadClientPlaceRows()));
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_PLACES",
      message: e instanceof Error ? e.message : "Failed to count clients by place",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
