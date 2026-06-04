"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type RevenueChartPoint = {
  label: string;
  bespoke: number;
  rtw: number;
  consultations: number;
};

function formatNGN(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1000)}k`;
  return `₦${Math.round(n)}`;
}

export function ExecutiveRevenueChart({
  data,
  total,
}: {
  data: RevenueChartPoint[];
  total: number;
}) {
  return (
    <div className="card-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
          Revenue · Last 7 days
        </p>
        <span className="rounded-full bg-sand/50 px-3 py-1 font-sans text-[11px] text-choc">
          {formatNGN(total)} total
        </span>
      </div>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#98755B" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatNGN} tick={{ fontSize: 10, fill: "#98755B" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(v) => formatNGN(Number(v ?? 0))}
              contentStyle={{ border: "1px solid #D4BBAC", borderRadius: 4, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="bespoke" stroke="#442913" strokeWidth={2} dot={false} name="Bespoke" />
            <Line type="monotone" dataKey="rtw" stroke="#98755B" strokeWidth={2} dot={false} name="Ready to Wear" />
            <Line type="monotone" dataKey="consultations" stroke="#D4BBAC" strokeWidth={2} dot={false} name="Consultations" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-6">
        {[
          { color: "#442913", label: "Bespoke", key: "bespoke" as const },
          { color: "#98755B", label: "Ready to Wear", key: "rtw" as const },
          { color: "#D4BBAC", label: "Consultations", key: "consultations" as const },
        ].map((item) => {
          const sum = data.reduce((acc, d) => acc + d[item.key], 0);
          return (
            <div key={item.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="font-sans text-[11px] text-text-mid">
                {item.label} · {formatNGN(sum)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
