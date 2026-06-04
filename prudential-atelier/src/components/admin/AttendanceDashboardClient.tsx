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
  const [resumptionTime, setResumptionTime] = useState("09:00");
  const [savingTime, setSavingTime] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const refresh = useCallback(async () => {
    const [todayRes, logsRes, qrRes, settingsRes] = await Promise.all([
      fetch("/api/attendance/today"),
      fetch("/api/attendance?limit=20"),
      fetch("/api/qr/current"),
      fetch("/api/attendance/settings"),
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
      const payload = JSON.stringify({
        code: data.code,
        date: new Date().toISOString().slice(0, 10),
        location: "Atelier Floor",
      });
      const url = await QRCode.toDataURL(payload, { width: 200, margin: 2 });
      setQrDataUrl(url);
    } else {
      setQrDataUrl(null);
    }

    if (settingsRes.ok) {
      const data = (await settingsRes.json()) as { resumptionTime: string };
      setResumptionTime(data.resumptionTime);
    }

    setLoading(false);
  }, []);

  async function saveResumptionTime() {
    setSavingTime(true);
    try {
      const res = await fetch("/api/attendance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumptionTime }),
      });
      if (!res.ok) {
        toast.error("Failed to save resumption time");
        return;
      }
      toast.success("Resumption time saved");
      await refresh();
    } finally {
      setSavingTime(false);
    }
  }

  async function regenerateQr() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/qr/regenerate", { method: "POST" });
      const data = (await res.json()) as { dataUrl?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to regenerate QR");
        return;
      }
      if (data.dataUrl) setQrDataUrl(data.dataUrl);
      toast.success("QR code regenerated");
    } finally {
      setRegenerating(false);
    }
  }

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
            Display at <a href="/attendance/qr" className="text-nut underline" target="_blank" rel="noreferrer">/attendance/qr</a>
          </p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Attendance QR code" className="mx-auto mt-6 rounded border border-sand" />
          ) : (
            <p className="mt-6 font-sans text-sm text-text-mid">No active QR code</p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" loading={regenerating} onClick={() => void regenerateQr()}>
              Regenerate QR Now
            </Button>
            {qrDataUrl ? (
              <a
                href={qrDataUrl}
                download="attendance-qr.png"
                className="text-center font-sans text-xs text-nut underline"
              >
                Download PNG
              </a>
            ) : null}
          </div>
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

      <section className="card-surface p-6">
        <h2 className="font-display text-lg text-ink">Late alert configuration</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          Staff clocking in after this time are marked late. HR receives alerts via the daily cron.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="font-sans text-[10px] uppercase text-text-light">Resumption time</label>
            <input
              type="time"
              value={resumptionTime}
              onChange={(e) => setResumptionTime(e.target.value)}
              className="mt-1 block rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </div>
          <Button loading={savingTime} onClick={() => void saveResumptionTime()}>
            Save
          </Button>
        </div>
      </section>

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
