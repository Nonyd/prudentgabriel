import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { CSP_REPORT_MAX_BYTES, parseCspReports } from "@/lib/csp-report";

/**
 * Receives CSP report-only violations (Slice AZ4) and counts them by
 * directive + blocked origin + first path segment. Always 204: a browser
 * cannot act on an error, and an attacker learns nothing.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "csp-report", 60, 15 * 60 * 1000);
  if (limited) return new Response(null, { status: 204 });

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > CSP_REPORT_MAX_BYTES) return new Response(null, { status: 204 });

  let payload: unknown;
  try {
    const text = await req.text();
    if (text.length > CSP_REPORT_MAX_BYTES) return new Response(null, { status: 204 });
    payload = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }

  const now = new Date();
  for (const v of parseCspReports(payload)) {
    try {
      await prisma.cspViolation.upsert({
        where: { directive_blockedOrigin_documentPath: v },
        create: { ...v, firstSeenAt: now, lastSeenAt: now },
        update: { count: { increment: 1 }, lastSeenAt: now },
      });
    } catch {
      // Reporting must never fail a page; a lost count is fine.
    }
  }
  return new Response(null, { status: 204 });
}
