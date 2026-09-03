import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/api-auth";

/**
 * Disabled (Slice V0.1). The job wrote `isFeatured` from a threshold key the
 * settings form does not save, and overwrote Mrs. Prudent's homepage picks
 * every night. `isFeatured` stays a manual editorial flag. Route kept so a
 * leftover host crontab line cannot 404-loop; it no longer writes products.
 */
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    disabled: true,
    reason: "update-bestsellers is retired; isFeatured is manual",
  });
}
