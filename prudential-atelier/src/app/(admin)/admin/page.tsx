import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KPICard } from "@/components/admin/KPICard";
import { formatPrice } from "@/lib/utils";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  let todayRevenue = 0;
  let activeBespoke = 0;
  let pendingPayments = 0;
  let consultationsToday = 0;
  let pipeline: {
    id: string;
    ref: string;
    client: string;
    stage: string;
    due: string;
    status: string;
    progress: number;
  }[] = [];
  let consultations: {
    id: string;
    time: string;
    client: string;
    type: string;
    paid: boolean;
  }[] = [];

  try {
    const [revenueAgg, bespokeCount, pendingCount, consultCount, bespokeList, consultList] =
      await Promise.all([
        prisma.order.aggregate({
          where: { paymentStatus: "PAID", createdAt: { gte: dayStart, lte: dayEnd } },
          _sum: { total: true },
        }),
        prisma.bespokeRequest.count({
          where: { status: { in: ["PENDING", "REVIEWED", "CONFIRMED", "IN_PROGRESS"] } },
        }),
        prisma.order.count({ where: { paymentStatus: "PENDING" } }),
        prisma.consultationBooking.count({
          where: {
            confirmedDate: { gte: dayStart, lte: dayEnd },
            status: { notIn: ["CANCELLED_BY_CLIENT", "CANCELLED_BY_ADMIN"] },
          },
        }),
        prisma.bespokeRequest.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            requestNumber: true,
            name: true,
            status: true,
            preferredDate: true,
          },
        }),
        prisma.consultationBooking.findMany({
          where: { confirmedDate: { gte: dayStart, lte: dayEnd } },
          take: 5,
          orderBy: { confirmedDate: "asc" },
          select: {
            id: true,
            clientName: true,
            confirmedDate: true,
            confirmedTime: true,
            paymentStatus: true,
            offering: { select: { sessionType: true } },
          },
        }),
      ]);

    todayRevenue = revenueAgg._sum.total ?? 0;
    activeBespoke = bespokeCount;
    pendingPayments = pendingCount;
    consultationsToday = consultCount;

    pipeline = bespokeList.map((b) => ({
      id: b.id,
      ref: b.requestNumber,
      client: b.name,
      stage: b.status.replace(/_/g, " "),
      due: b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-GB") : "—",
      status: b.status,
      progress: 35,
    }));

    consultations = consultList.map((c) => ({
      id: c.id,
      time: c.confirmedTime ?? (c.confirmedDate ? c.confirmedDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"),
      client: c.clientName,
      type: c.offering.sessionType.replace(/_/g, " "),
      paid: c.paymentStatus === "PAID",
    }));
  } catch {
    // DB unavailable — show empty dashboard
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Overview</p>
        <h2 className="mt-2 font-serif text-2xl font-medium text-choc">Operations Dashboard</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard label="Today's Revenue" value={formatPrice(todayRevenue, "NGN")} />
        <KPICard label="Active Bespoke" value={String(activeBespoke)} />
        <KPICard label="Staff On Clock" value="—" hint="Attendance module in Phase 2" />
        <KPICard label="Pending Payments" value={String(pendingPayments)} />
        <KPICard label="Consultations Today" value={String(consultationsToday)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card-surface overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-sand px-5 py-4">
            <h3 className="font-serif text-lg font-medium text-choc">Bespoke Pipeline</h3>
            <Link href="/admin/bespoke" className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-nut">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-sand font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center font-sans text-sm text-text-mid">
                      No active bespoke orders yet.
                    </td>
                  </tr>
                ) : (
                  pipeline.map((row) => (
                    <tr key={row.id} className="border-b border-sand/60 font-sans text-xs text-text-dark">
                      <td className="px-5 py-3">
                        <Link href={`/admin/bespoke/${row.id}`} className="text-nut hover:underline">
                          {row.ref}
                        </Link>
                      </td>
                      <td className="px-5 py-3">{row.client}</td>
                      <td className="px-5 py-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sand">
                          <div className="h-full bg-nut" style={{ width: `${row.progress}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-3 capitalize">{row.stage.toLowerCase()}</td>
                      <td className="px-5 py-3">{row.due}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-sm bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-mid">
                          {row.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-surface">
          <div className="border-b border-sand px-5 py-4">
            <h3 className="font-serif text-lg font-medium text-choc">Daily Summary</h3>
          </div>
          <dl className="space-y-4 px-5 py-5 font-sans text-sm">
            <div className="flex justify-between">
              <dt className="text-text-mid">Revenue today</dt>
              <dd className="font-medium text-choc">{formatPrice(todayRevenue, "NGN")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-mid">Active bespoke</dt>
              <dd className="font-medium text-choc">{activeBespoke}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-mid">Pending payments</dt>
              <dd className="font-medium text-choc">{pendingPayments}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-mid">Consultations today</dt>
              <dd className="font-medium text-choc">{consultationsToday}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <h3 className="font-serif text-lg font-medium text-choc">Today&apos;s Consultations</h3>
          <Link href="/admin/consultations" className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-nut">
            View all
          </Link>
        </div>
        <div className="divide-y divide-sand">
          {consultations.length === 0 ? (
            <p className="px-5 py-10 text-center font-sans text-sm text-text-mid">
              No consultations scheduled for today.
            </p>
          ) : (
            consultations.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-sans text-xs font-medium text-choc">{c.time}</p>
                  <p className="mt-1 font-sans text-sm text-text-dark">{c.client}</p>
                  <p className="mt-0.5 font-sans text-[11px] text-text-mid">{c.type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-sm px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${
                      c.paid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}
                  >
                    {c.paid ? "Paid" : "Unpaid"}
                  </span>
                  <button type="button" className="btn-ghost-light px-4 py-2 text-[9px]">
                    Send link
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
