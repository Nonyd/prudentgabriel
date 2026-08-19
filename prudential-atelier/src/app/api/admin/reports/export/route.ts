import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { logError } from "@/lib/logger";
import { renderReportPdfBuffer } from "@/lib/render-report-pdf";

function formatNGN(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("reports");
  if (!gate.ok) return gate.response;

  try {
    const preset = req.nextUrl.searchParams.get("preset") ?? "this_month";
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/admin/reports?preset=${preset}`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Could not load report data" }, { status: 500 });
    }

    const data = (await res.json()) as {
      kpis: Record<string, { value: number; change: number }>;
      topClients: { name: string; totalSpend: number; tier: string }[];
    };

    const kpiLabels: Record<string, string> = {
      totalRevenue: "Total Revenue",
      bespokeRevenue: "Bespoke Revenue",
      rtwRevenue: "RTW Revenue",
      newClients: "New Clients",
      ordersCompleted: "Orders Completed",
      consultations: "Consultations",
    };

    const buf = await renderReportPdfBuffer({
      title: `Executive Report — ${preset.replace(/_/g, " ")}`,
      kpis: Object.entries(data.kpis).map(([key, v]) => ({
        label: kpiLabels[key] ?? key,
        value: key.includes("Revenue") ? formatNGN(v.value) : String(v.value),
        change: `${v.change >= 0 ? "+" : ""}${v.change}%`,
      })),
      topClients: data.topClients.map((c) => ({
        name: c.name,
        spend: formatNGN(c.totalSpend),
        tier: c.tier,
      })),
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="prudential-report-${preset}.pdf"`,
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
