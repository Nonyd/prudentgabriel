"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { STAGE_LABELS } from "@/lib/bespoke-stages";
import { formatDate, getInitials } from "@/lib/utils";

type StaffDetail = {
  id: string;
  department: string;
  employmentType: string;
  skillTags: string[];
  isActive: boolean;
  user: { name: string | null; email: string; phone: string | null };
  assignments: {
    id: string;
    role: string;
    assignedAt: string;
    completedAt: string | null;
    order: {
      id: string;
      orderRef: string;
      clientName: string;
      currentStage: string;
      status: string;
    };
  }[];
  attendanceLogs: {
    id: string;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    totalHours: number | null;
    taskNote: string | null;
  }[];
};

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StaffProfileClient({ staffId }: { staffId: string }) {
  const [item, setItem] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/staff/${staffId}`);
    if (!res.ok) {
      toast.error("Failed to load staff profile");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { item: StaffDetail };
    setItem(data.item);
    setLoading(false);
  }, [staffId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return <p className="font-sans text-sm text-text-mid">Loading profile…</p>;
  }

  if (!item) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="font-display text-xl text-ink">Staff member not found</p>
        <Link href="/admin/staff" className="mt-4 inline-block">
          <Button variant="secondary">Back to staff</Button>
        </Link>
      </div>
    );
  }

  const activeAssignments = item.assignments.filter((a) => !a.completedAt);
  const completedAssignments = item.assignments.filter((a) => a.completedAt);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-choc font-sans text-lg font-medium text-cream">
            {getInitials(item.user.name ?? item.user.email)}
          </div>
          <div>
            <Link
              href="/admin/staff"
              className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
            >
              ← Staff directory
            </Link>
            <h1 className="mt-1 font-display text-2xl text-ink">
              {item.user.name ?? item.user.email}
            </h1>
            <p className="mt-1 font-sans text-sm text-text-mid">{item.user.email}</p>
            {item.user.phone ? (
              <p className="font-sans text-sm text-text-mid">{item.user.phone}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="accent">{item.department.replace(/_/g, " ")}</Badge>
              <Badge variant={item.isActive ? "success" : "wine"}>
                {item.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="grey">{item.employmentType}</Badge>
            </div>
          </div>
        </div>
      </div>

      {item.skillTags.length > 0 ? (
        <section className="card-surface p-6">
          <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
            Skills
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.skillTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-sand/30 px-3 py-1 font-sans text-xs text-text-mid"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card-surface overflow-hidden">
        <div className="border-b border-sand px-6 py-4">
          <h2 className="font-display text-lg text-ink">Active Assignments</h2>
          <p className="font-sans text-xs text-text-mid">{activeAssignments.length} in progress</p>
        </div>
        {activeAssignments.length === 0 ? (
          <p className="px-6 py-8 font-sans text-sm text-text-mid">No active assignments</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-sand bg-bg/50 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Stage</th>
                </tr>
              </thead>
              <tbody>
                {activeAssignments.map((a) => (
                  <tr key={a.id} className="border-b border-sand/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/bespoke/${a.order.id}`}
                        className="font-sans text-sm font-medium text-nut hover:underline"
                      >
                        {a.order.orderRef}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-text-mid">
                      {a.order.clientName}
                    </td>
                    <td className="px-4 py-3 font-sans text-xs uppercase text-text-mid">
                      {a.role}
                    </td>
                    <td className="px-4 py-3 font-sans text-xs text-text-mid">
                      {STAGE_LABELS[a.order.currentStage as keyof typeof STAGE_LABELS] ??
                        a.order.currentStage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {completedAssignments.length > 0 ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-lg text-ink">Completed Assignments</h2>
          <p className="mt-1 font-sans text-xs text-text-mid">
            {completedAssignments.length} completed
          </p>
          <ul className="mt-4 space-y-2">
            {completedAssignments.slice(0, 10).map((a) => (
              <li key={a.id} className="flex justify-between font-sans text-sm text-text-mid">
                <span>{a.order.orderRef} — {a.role}</span>
                <span className="text-xs">{formatDate(a.completedAt!)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card-surface overflow-hidden">
        <div className="border-b border-sand px-6 py-4">
          <h2 className="font-display text-lg text-ink">Attendance History</h2>
          <p className="font-sans text-xs text-text-mid">Last 30 records</p>
        </div>
        {item.attendanceLogs.length === 0 ? (
          <p className="px-6 py-8 font-sans text-sm text-text-mid">No attendance records</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-sand bg-bg/50 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Clock In</th>
                  <th className="px-4 py-3">Clock Out</th>
                  <th className="px-4 py-3">Hours</th>
                </tr>
              </thead>
              <tbody>
                {item.attendanceLogs.map((log) => (
                  <tr key={log.id} className="border-b border-sand/60">
                    <td className="px-4 py-3 font-sans text-sm">{formatDate(log.date)}</td>
                    <td className="px-4 py-3 font-sans text-sm">{formatTime(log.clockIn)}</td>
                    <td className="px-4 py-3 font-sans text-sm">{formatTime(log.clockOut)}</td>
                    <td className="px-4 py-3 font-sans text-sm">
                      {log.totalHours != null ? `${log.totalHours}h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
