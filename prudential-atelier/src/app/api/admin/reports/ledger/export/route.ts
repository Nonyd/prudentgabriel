import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { logError } from "@/lib/logger";
import type { FinanceLine } from "@/lib/finance/classify";
import { LEDGER_HEADERS, ledgerRow } from "@/lib/finance/export-rows";
import { customRange, financeRange, type FinancePeriodKind } from "@/lib/finance/period";
import { buildFinanceReport } from "@/lib/finance/query";
import { toCsv, toExcelXml } from "@/lib/finance/spreadsheet";

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
  const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  try {
    const range =
      fromParam && toParam ? customRange(fromParam, toParam) : financeRange(kind, new Date());
    const report = await buildFinanceReport(range.from, range.to, line);
    const rows = report.lines.map(ledgerRow);
    const stamp = range.from.toISOString().slice(0, 10);
    if (format === "xlsx") {
      const xml = toExcelXml("Ledger", LEDGER_HEADERS, rows);
      return new NextResponse(xml, {
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="accounts-${stamp}.xls"`,
        },
      });
    }
    const csv = toCsv(LEDGER_HEADERS, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="accounts-${stamp}.csv"`,
      },
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ADMIN_LEDGER_EXPORT",
      message: e instanceof Error ? e.message : "Ledger export failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
