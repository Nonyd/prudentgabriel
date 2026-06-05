"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReportData = {
  kpis: Record<string, { value: number; change: number }>;
  revenueChart: { date: string; bespoke: number; rtw: number }[];
  pipeline: { stage: string; count: number }[];
  topClients: { name: string; totalSpend: number; tier: string }[];
  staffAttendance: { name: string; days: number; late: number }[];
  consultationsSummary?: {
    total: number;
    byStatus: { status: string; count: number; revenue: number }[];
  };
  inventory?: { product: string; category: string | null; size: string; stock: number; status: string }[];
  production?: {
    orderRef: string;
    clientName: string;
    stage: string;
    tailor: string;
    deliveryDate: string | null;
    overdue: boolean;
  }[];
  staffProductivity?: { name: string; completed: number }[];
};

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
];

function formatNGN(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function KpiCard({ label, value, change }: { label: string; value: number; change: number }) {
  const up = change >= 0;
  return (
    <div className="card-surface p-5">
      <p className="font-sans text-[10px] uppercase tracking-wider text-text-light">{label}</p>
      <p className="mt-2 font-display text-2xl text-choc">
        {label.includes("Revenue") || label.includes("RTW") || label.includes("Bespoke")
          ? formatNGN(value)
          : value}
      </p>
      <p className={`mt-1 font-sans text-xs ${up ? "text-green-600" : "text-red-600"}`}>
        {up ? "↑" : "↓"} {Math.abs(change)}% vs prior period
      </p>
    </div>
  );
}

export function ReportsDashboardClient() {
  const [preset, setPreset] = useState("this_month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?preset=${preset}`);
      if (res.ok) setData((await res.json()) as ReportData);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Metric", "Value", "Change %"],
      ...Object.entries(data.kpis).map(([k, v]) => [k, String(v.value), String(v.change)]),
      [],
      ["Date", "Bespoke", "RTW"],
      ...data.revenueChart.map((r) => [r.date, String(r.bespoke), String(r.rtw)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prudential-report-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const res = await fetch(`/api/admin/reports/export?preset=${preset}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prudential-report-${preset}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-choc">Executive Reports</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">Mrs. Prudent — interactive performance dashboard</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`px-4 py-2 font-sans text-xs uppercase tracking-wider ${
              preset === p.id ? "bg-nut text-cream" : "border border-sand text-text-mid"
            }`}
          >
            {p.label}
          </button>
        ))}
        {data ? (
          <>
            <button type="button" onClick={exportCsv} className="btn-ghost-light ml-auto text-[10px]">
              Export CSV
            </button>
            <button type="button" onClick={() => void exportPdf()} className="btn-primary text-[10px]">
              Download PDF
            </button>
          </>
        ) : null}
      </div>

      {loading || !data ? (
        <p className="font-sans text-sm text-text-mid">Loading report data…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Total Revenue" value={data.kpis.totalRevenue!.value} change={data.kpis.totalRevenue!.change} />
            <KpiCard label="Bespoke Revenue" value={data.kpis.bespokeRevenue!.value} change={data.kpis.bespokeRevenue!.change} />
            <KpiCard label="RTW Revenue" value={data.kpis.rtwRevenue!.value} change={data.kpis.rtwRevenue!.change} />
            <KpiCard label="New Clients" value={data.kpis.newClients!.value} change={data.kpis.newClients!.change} />
            <KpiCard label="Orders Completed" value={data.kpis.ordersCompleted!.value} change={data.kpis.ordersCompleted!.change} />
            <KpiCard label="Consultations" value={data.kpis.consultations!.value} change={data.kpis.consultations!.change} />
          </div>

          <div className="card-surface p-6">
            <h2 className="font-display text-lg text-choc">Revenue breakdown</h2>
            <div className="mt-4 h-72 min-h-[300px] w-full" style={{ width: "100%", height: 300, minHeight: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4BBAC" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `₦${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatNGN(Number(v ?? 0))} />
                  <Legend />
                  <Line type="monotone" dataKey="bespoke" stroke="#5C3422" name="Bespoke" />
                  <Line type="monotone" dataKey="rtw" stroke="#98755B" name="RTW" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card-surface p-6">
              <h2 className="font-display text-lg text-choc">Bespoke pipeline</h2>
              <div className="mt-4 h-64 min-h-[300px] w-full" style={{ width: "100%", height: 300, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pipeline} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="stage" width={120} tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#5C3422" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-surface p-6">
              <h2 className="font-display text-lg text-choc">Top clients</h2>
              <table className="mt-4 w-full font-sans text-sm">
                <thead>
                  <tr className="border-b border-sand text-left text-xs text-text-light">
                    <th className="py-2">Client</th>
                    <th className="py-2 text-right">Spend</th>
                    <th className="py-2 text-right">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topClients.map((c, i) => (
                    <tr key={i} className="border-b border-sand/40">
                      <td className="py-2">{c.name}</td>
                      <td className="py-2 text-right">{formatNGN(c.totalSpend)}</td>
                      <td className="py-2 text-right text-text-mid">{c.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="font-display text-lg text-choc">Consultations</h2>
            {data.consultationsSummary ? (
              <div className="mt-4 space-y-2 font-sans text-sm">
                <p className="text-text-mid">Total bookings: {data.consultationsSummary.total}</p>
                {data.consultationsSummary.byStatus.map((s) => (
                  <p key={s.status} className="text-text-mid">
                    {s.status}: {s.count} · {formatNGN(s.revenue)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 font-sans text-sm text-text-mid">No consultation data for this period.</p>
            )}
          </div>

          <div className="card-surface p-6">
            <h2 className="font-display text-lg text-choc">Staff attendance</h2>
            <table className="mt-4 w-full font-sans text-sm">
              <thead>
                <tr className="border-b border-sand text-left text-xs text-text-light">
                  <th className="py-2">Staff</th>
                  <th className="py-2 text-right">Days clocked in</th>
                </tr>
              </thead>
              <tbody>
                {data.staffAttendance.map((s, i) => (
                  <tr key={i} className="border-b border-sand/40">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-right">{s.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.inventory && data.inventory.length > 0 ? (
            <div className="card-surface p-6">
              <h2 className="font-display text-lg text-choc">RTW inventory</h2>
              <table className="mt-4 w-full font-sans text-sm">
                <thead>
                  <tr className="border-b border-sand text-left text-xs text-text-light">
                    <th className="py-2">Product</th>
                    <th className="py-2">Size</th>
                    <th className="py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.map((row, i) => (
                    <tr key={i} className="border-b border-sand/40">
                      <td className="py-2">{row.product}</td>
                      <td className="py-2">{row.size}</td>
                      <td
                        className={`py-2 text-right ${
                          row.status === "out"
                            ? "text-red-700"
                            : row.status === "low"
                              ? "text-amber-700"
                              : ""
                        }`}
                      >
                        {row.stock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {data.production && data.production.length > 0 ? (
            <div className="card-surface p-6">
              <h2 className="font-display text-lg text-choc">Bespoke production</h2>
              <table className="mt-4 w-full font-sans text-sm">
                <thead>
                  <tr className="border-b border-sand text-left text-xs text-text-light">
                    <th className="py-2">Order</th>
                    <th className="py-2">Stage</th>
                    <th className="py-2">Assigned</th>
                    <th className="py-2">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {data.production.map((row) => (
                    <tr
                      key={row.orderRef}
                      className={`border-b border-sand/40 ${row.overdue ? "bg-red-50/50" : ""}`}
                    >
                      <td className="py-2">{row.orderRef}</td>
                      <td className="py-2">{row.stage}</td>
                      <td className="py-2">{row.tailor}</td>
                      <td className="py-2 text-xs">
                        {row.deliveryDate
                          ? new Date(row.deliveryDate).toLocaleDateString("en-GB")
                          : "—"}
                        {row.overdue ? " · Overdue" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {data.staffProductivity && data.staffProductivity.length > 0 ? (
            <div className="card-surface p-6">
              <h2 className="font-display text-lg text-choc">Staff productivity</h2>
              <p className="mt-1 font-sans text-xs text-text-mid">Assignments completed in selected period</p>
              <table className="mt-4 w-full font-sans text-sm">
                <thead>
                  <tr className="border-b border-sand text-left text-xs text-text-light">
                    <th className="py-2">Staff</th>
                    <th className="py-2 text-right">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffProductivity.map((s, i) => (
                    <tr key={i} className="border-b border-sand/40">
                      <td className="py-2">
                        {s.name}
                        {i === 0 ? (
                          <span className="ml-2 font-sans text-[10px] uppercase text-gold">Top</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">{s.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
