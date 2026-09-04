import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { logError } from "@/lib/logger";
import { AA0_LINES } from "@/lib/finance/aa0";
import type { FinanceLine } from "@/lib/finance/classify";
import { customRange, financeRange, type FinancePeriodKind } from "@/lib/finance/period";
import { buildFinanceReport } from "@/lib/finance/query";

function parseKind(raw: string | null): FinancePeriodKind {
  if (raw === "day" || raw === "week" || raw === "month" || raw === "year") return raw;
  return "month";
}

function parseLine(raw: string | null): FinanceLine | undefined {
  if (raw === "RTW" || raw === "ATELIER") return raw;
  return undefined;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("reports");
  if (!gate.ok) return gate.response;

  const kind = parseKind(req.nextUrl.searchParams.get("kind"));
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const line = parseLine(req.nextUrl.searchParams.get("line"));

  try {
    const range =
      fromParam && toParam ? customRange(fromParam, toParam) : financeRange(kind, new Date());
    const report = await buildFinanceReport(range.from, range.to, line);
    return NextResponse.json({
      aa0: AA0_LINES,
      ...report,
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ADMIN_LEDGER_REPORT",
      message: e instanceof Error ? e.message : "Ledger report failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
