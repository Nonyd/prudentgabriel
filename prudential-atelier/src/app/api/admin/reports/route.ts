import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { logError } from "@/lib/logger";
import { AA0_LINES } from "@/lib/finance/aa0";
import { customRange, financeRange, type FinancePeriodKind } from "@/lib/finance/period";
import { bestSellingPieces, buildFinanceReport } from "@/lib/finance/query";
import type { FinanceLine } from "@/lib/finance/classify";

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

  const kind = parseKind(req.nextUrl.searchParams.get("kind") ?? req.nextUrl.searchParams.get("preset"));
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const line = parseLine(req.nextUrl.searchParams.get("line"));

  try {
    const range =
      fromParam && toParam
        ? { ...customRange(fromParam, toParam), kind, label: `${fromParam} – ${toParam}`, prevFrom: new Date(0), prevTo: new Date(0), prevLabel: "" }
        : financeRange(kind, new Date());

    const [current, previous, bestsellers] = await Promise.all([
      buildFinanceReport(range.from, range.to, line),
      range.prevTo.getTime() > 0 ? buildFinanceReport(range.prevFrom, range.prevTo, line) : Promise.resolve(null),
      bestSellingPieces(range.from, range.to),
    ]);

    return NextResponse.json({
      aa0: AA0_LINES,
      range: {
        kind: range.kind,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
        prevLabel: range.prevLabel,
      },
      current: {
        rtw: current.rtw,
        atelier: current.atelier,
        combined: current.combined,
      },
      previous: previous
        ? { rtw: previous.rtw, atelier: previous.atelier, combined: previous.combined }
        : null,
      outstanding: {
        oversellNGN: current.combined.liabilityNGN,
        pointsNGN: current.pointsLiabilityNGN,
        points: current.pointsOutstanding,
        rateNGN: current.pointsRateNGN,
        asOf: current.asOf,
      },
      bestsellers,
      unassignedCount: current.unassigned.length,
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ADMIN_REPORTS",
      message: e instanceof Error ? e.message : "Reports failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
