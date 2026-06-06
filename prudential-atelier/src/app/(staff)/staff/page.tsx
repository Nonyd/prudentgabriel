"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type DashboardData = {
  clockStatus: {
    isClockedIn: boolean;
    clockIn: string | null;
    taskNote: string | null;
    hoursToday: number | null;
  };
  assignments: {
    id: string;
    orderId: string;
    orderRef: string;
    outfitDescription: string | null;
    clientFirstName: string;
    role: string;
    deliveryDate: string | null;
    status: string;
    daysUntilDelivery: number | null;
  }[];
  summary: {
    hoursToday: number;
    tasksCompletedWeek: number;
    attendanceScore: number | null;
  };
};

export default function StaffDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/staff/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d as DashboardData))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-choc" />
      </div>
    );
  }

  if (!data) {
    return <p className="font-sans text-sm text-text-mid">Unable to load dashboard.</p>;
  }

  const { clockStatus, assignments, summary } = data;

  const clockBanner = !clockStatus.isClockedIn ? (
    <div className="staff-card border-amber-500/25 bg-amber-500/10 px-4 py-4 md:px-5 md:py-5">
      <p className="font-sans text-sm font-medium text-choc">You haven&apos;t clocked in yet today</p>
      <Link href="/staff/time" className="mt-3 inline-block">
        <Button size="sm">Clock in now →</Button>
      </Link>
    </div>
  ) : (
    <div className="staff-card border-emerald-500/25 bg-emerald-500/10 px-4 py-4 md:px-5 md:py-5">
      <p className="font-sans text-sm font-medium text-choc">
        ✓ Clocked in at{" "}
        {clockStatus.clockIn ? format(new Date(clockStatus.clockIn), "h:mm a") : "—"}
      </p>
      {clockStatus.taskNote ? (
        <p className="mt-1 font-sans text-xs text-text-mid">Working on: {clockStatus.taskNote}</p>
      ) : null}
      <Link href="/staff/time" className="mt-3 inline-block">
        <Button variant="ghost" size="sm">
          Clock out
        </Button>
      </Link>
    </div>
  );

  const summaryCards = (
    <>
      <div className="staff-card p-4 text-center md:p-5">
        <p className="font-display text-2xl text-choc md:text-3xl">{summary.hoursToday.toFixed(1)}h</p>
        <p className="mt-1 font-sans text-[10px] uppercase tracking-wide text-text-mid">Today</p>
      </div>
      <div className="staff-card p-4 text-center md:p-5">
        <p className="font-display text-2xl text-choc md:text-3xl">{summary.tasksCompletedWeek}</p>
        <p className="mt-1 font-sans text-[10px] uppercase tracking-wide text-text-mid">This week</p>
      </div>
      <div className="staff-card p-4 text-center md:p-5">
        <p className="font-display text-2xl text-choc md:text-3xl">
          {summary.attendanceScore != null ? `${Math.round(summary.attendanceScore)}%` : "—"}
        </p>
        <p className="mt-1 font-sans text-[10px] uppercase tracking-wide text-text-mid">Attendance</p>
      </div>
    </>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="font-display text-2xl text-choc md:text-3xl">Today</h1>
        <p className="font-sans text-sm text-text-mid">{format(new Date(), "EEEE, d MMMM")}</p>
      </div>

      {clockBanner}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:hidden">{summaryCards}</section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <section>
          <h2 className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            My assignments
          </h2>
          {assignments.length === 0 ? (
            <p className="staff-card p-4 font-sans text-sm text-text-mid">
              No active assignments right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/staff/orders/${a.orderId}`}
                  className="staff-card block p-4 transition-shadow hover:shadow-sm md:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-lightbr">
                        {a.orderRef}
                      </p>
                      <p className="mt-1 font-display text-lg text-choc">
                        {a.outfitDescription ?? "Bespoke order"}
                      </p>
                      <p className="mt-1 font-sans text-xs text-text-mid">Client: {a.clientFirstName}</p>
                      <p className="mt-1 font-sans text-xs text-text-mid">{a.role}</p>
                    </div>
                    <Badge variant={a.status === "Complete" ? "success" : "gold"}>{a.status}</Badge>
                  </div>
                  {a.deliveryDate ? (
                    <p className="mt-2 font-sans text-xs text-text-mid">
                      Delivery: {format(new Date(a.deliveryDate), "d MMM yyyy")}
                      {a.daysUntilDelivery != null ? ` · ${a.daysUntilDelivery} days` : ""}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="hidden grid-cols-1 gap-3 lg:grid">{summaryCards}</section>
      </div>
    </div>
  );
}
