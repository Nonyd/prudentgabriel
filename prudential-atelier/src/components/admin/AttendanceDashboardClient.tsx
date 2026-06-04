"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

type TodaySummary = {
  date: string;
  resumptionTime: string;
  summary: { clockedIn: number; late: number; absent: number; freelancers: number };
  staff: {
    staffId: string;
    name: string;
    department: string;
    employmentType: string;
    status: string;
    log: { clockIn: string | null; clockOut: string | null } | null;
  }[];
};

type AttendanceLog = {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: number | null;
  staff: { user: { name: string | null; email: string } };
};

function statusBadge(status: string) {
  switch (status) {
    case "clocked_in":
      return <Badge variant="success">Clocked in</Badge>;
    case "late":
      return <Badge variant="gold">Late</Badge>;
    case "clocked_out":
      return <Badge variant="grey">Clocked out</Badge>;
    case "freelancer":
      return <Badge variant="outline-gold">Freelancer</Badge>;
    default:
      return <Badge variant="wine">Absent</Badge>;
  }
}

export function AttendanceDashboardClient() {
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [todayRes, logsRes, qrRes] = await Promise.all([
      fetch("/api/attendance/today"),
      fetch("/api/attendance?limit=20"),
      fetch("/api/qr/current"),
    ]);

    if (todayRes.ok) {
      setToday((await todayRes.json()) as TodaySummary);
    } else {
      toast.error("Failed to load today's attendance");
    }

    if (logsRes.ok) {
      const data = (await logsRes.json()) as { items: AttendanceLog[] };
      setLogs(data.items);
    }

    if (qrRes.ok) {
      const data = (await qrRes.json()) as { code: string };
      const url = await QRCode.toDataURL(data.code, { width: 200, margin: 2 });
      setQrDataUrl(url);
    } else {
      setQrDataUrl(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return <p className="font-sans text-sm text-text-mid">Loading attendance…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="font-display text-2xl text-ink">Attendance Dashboard</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            {today ? formatDate(today.date) : "Today"} · Resumption {today?.resumptionTime ?? "09:00"}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clocked in", value: today?.summary.clockedIn ?? 0 },
          { label: "Late", value: today?.summary.late ?? 0 },
          { label: "Absent", value: today?.summary.absent ?? 0 },
          { label: "Freelancers", value: today?.summary.freelancers ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="card-surface p-5">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              {kpi.label}
            </p>
            <p className="mt-2 font-display text-3xl text-choc">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-surface p-6 lg:col-span-1">
          <h2 className="font-display text-lg text-ink">Office QR Code</h2>
          <p className="mt-1 font-sans text-xs text-text-mid">
            Display for staff to scan at /clock-in
          </p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Attendance QR code" className="mx-auto mt-6 rounded border border-sand" />
          ) : (
            <p className="mt-6 font-sans text-sm text-text-mid">No active QR code</p>
          )}
        </div>

        <div className="card-surface overflow-hidden lg:col-span-2">
          <div className="border-b border-sand px-6 py-4">
            <h2 className="font-display text-lg text-ink">Today&apos;s staff grid</h2>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {today?.staff.map((member) => (
              <div
                key={member.staffId}
                className="rounded border border-sand/60 bg-ivory/50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-sans text-sm font-medium text-ink">{member.name}</p>
                    <p className="font-sans text-[10px] uppercase text-text-light">
                      {member.department.replace(/_/g, " ")}
                    </p>
                  </div>
                  {statusBadge(member.status)}
                </div>
                {member.log?.clockIn ? (
                  <p className="mt-2 font-sans text-xs text-text-mid">
                    In: {new Date(member.log.clockIn).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                    {member.log.clockOut
                      ? ` · Out: ${new Date(member.log.clockOut).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="card-surface overflow-hidden">
        <div className="border-b border-sand px-6 py-4">
          <h2 className="font-display text-lg text-ink">Recent Logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-sand bg-bg/50 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Clock In</th>
                <th className="px-4 py-3">Clock Out</th>
                <th className="px-4 py-3">Hours</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-sand/60">
                  <td className="px-4 py-3 font-sans text-sm">
                    {log.staff.user.name ?? log.staff.user.email}
                  </td>
                  <td className="px-4 py-3 font-sans text-sm">{formatDate(log.date)}</td>
                  <td className="px-4 py-3 font-sans text-sm">
                    {log.clockIn
                      ? new Date(log.clockIn).toLocaleTimeString("en-NG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-sans text-sm">
                    {log.clockOut
                      ? new Date(log.clockOut).toLocaleTimeString("en-NG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-sans text-sm">
                    {log.totalHours != null ? `${log.totalHours}h` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
