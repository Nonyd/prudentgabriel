"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Row = {
  staffId: string;
  name: string;
  department: string;
  jobTitle: string | null;
  ordersCompleted: number;
  avgStageHours: number | null;
  attendanceScore: number | null;
  punctualityScore: number | null;
};

export function StaffPerformanceClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff/performance");
      if (res.ok) {
        const data = (await res.json()) as { items: Row[] };
        setRows(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Staff & HR</p>
        <h1 className="font-display text-2xl text-ink">Staff performance</h1>
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-choc" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand bg-bg-card">
          <table className="w-full min-w-[720px] text-left font-sans text-sm">
            <thead>
              <tr className="border-b border-sand text-xs uppercase text-text-light">
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Avg stage (h)</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Punctuality</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staffId} className="border-b border-sand/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-text-light">{r.department}</p>
                  </td>
                  <td className="px-4 py-3 text-text-mid">{r.jobTitle ?? "—"}</td>
                  <td className="px-4 py-3">{r.ordersCompleted}</td>
                  <td className="px-4 py-3">{r.avgStageHours?.toFixed(1) ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.attendanceScore != null ? `${Math.round(r.attendanceScore)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.punctualityScore != null ? `${Math.round(r.punctualityScore)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
