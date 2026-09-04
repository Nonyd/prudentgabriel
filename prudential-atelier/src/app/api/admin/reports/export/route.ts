import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { logError } from "@/lib/logger";
import type { LineTotals } from "@/lib/finance/classify";
import { financeRange, type FinancePeriodKind } from "@/lib/finance/period";
import { bestSellingPieces, buildFinanceReport } from "@/lib/finance/query";
import { renderReportPdfBuffer } from "@/lib/render-report-pdf";

function formatNGN(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function parseKind(raw: string | null): FinancePeriodKind {
  if (raw === "day" || raw === "today" || raw === "this_day") return "day";
  if (raw === "week" || raw === "this_week") return "week";
  if (raw === "year" || raw === "this_year") return "year";
  return "month";
}

function changePct(now: number, prev: number): string {
  if (prev === 0) return now === 0 ? "0%" : "—";
  const pct = Math.round(((now - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function kpi(label: string, now: number, prev: number) {
  return { label, value: formatNGN(now), change: changePct(now, prev) };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("reports");
  if (!gate.ok) return gate.response;

  try {
    const kind = parseKind(req.nextUrl.searchParams.get("kind") ?? req.nextUrl.searchParams.get("preset"));
    const range = financeRange(kind, new Date());
    const [current, previous, bestsellers] = await Promise.all([
      buildFinanceReport(range.from, range.to),
      buildFinanceReport(range.prevFrom, range.prevTo),
      bestSellingPieces(range.from, range.to),
    ]);
    const prev: LineTotals = previous.combined;

    const buf = await renderReportPdfBuffer({
      title: `How we are doing — ${range.label}`,
      kpis: [
        kpi("Together · sales", current.combined.salesNGN, prev.salesNGN),
        kpi("Together · cash", current.combined.cashNGN, prev.cashNGN),
        kpi("Ready-to-wear · sales", current.rtw.salesNGN, previous.rtw.salesNGN),
        kpi("Atelier · sales", current.atelier.salesNGN, previous.atelier.salesNGN),
      ],
      topClients: bestsellers.map((b) => ({
        name: b.name,
        spend: formatNGN(b.salesNGN),
        tier: `${b.quantity} sold`,
      })),
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="how-we-are-doing-${kind}.pdf"`,
      },
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ADMIN_REPORT_EXPORT",
      message: e instanceof Error ? e.message : "Report export failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
