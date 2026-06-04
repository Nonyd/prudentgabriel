import Link from "next/link";
import { BespokeStage, ConsultationStatus, EmploymentType, PaymentStatus } from "@prisma/client";
import { CalendarDays, CreditCard, Scissors, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ExecutiveKPICard } from "@/components/admin/ExecutiveKPICard";
import { ExecutiveRevenueChart, type RevenueChartPoint } from "@/components/admin/ExecutiveRevenueChart";
import { formatNGN, getInitials } from "@/lib/utils";

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

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default async function AdminDashboardPage() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart.getTime() - 1);
  const inSevenDays = new Date(now);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  let revenueThisWeek = 0;
  let revenueLastWeek = 0;
  let activeCommissions = 0;
  let nearingDelivery = 0;
  let consultationsThisWeek = 0;
  let consultationsLastWeek = 0;
  let outstandingBalance = 0;
  let outstandingOrders = 0;
  let ordersAdvancedToday = 0;
  let deliveriesToday = 0;
  let paymentsToday = 0;
  let confirmationsPending = 0;
  let revenueChart: RevenueChartPoint[] = [];
  let attendanceOnClock = 0;
  let attendanceLateOrAbsent = 0;
  const staffRows: {
    name: string;
    initials: string;
    status: "in" | "out";
    time?: string;
    badge: string;
  }[] = [];

  try {
    const chartDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dayStart);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const [
      rtwWeek,
      rtwLastWeek,
      consultPaidWeek,
      consultPaidLastWeek,
      bespokePaidWeek,
      bespokePaidLastWeek,
      activeCount,
      nearCount,
      consultBookedWeek,
      consultBookedLastWeek,
      balanceAgg,
      balanceOrders,
      stageLogsToday,
      deliveryTodayCount,
      orderPaidToday,
      consultPaidToday,
      pendingConfirm,
      chartData,
      staffList,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, paidAt: { gte: weekStart, lte: dayEnd }, isBespoke: false },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: lastWeekStart, lte: lastWeekEnd },
          isBespoke: false,
        },
        _sum: { total: true },
      }),
      prisma.consultationBooking.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, paidAt: { gte: weekStart, lte: dayEnd } },
        _sum: { feeNGN: true },
      }),
      prisma.consultationBooking.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, paidAt: { gte: lastWeekStart, lte: lastWeekEnd } },
        _sum: { feeNGN: true },
      }),
      prisma.bespokeOrder.aggregate({
        where: { updatedAt: { gte: weekStart, lte: dayEnd } },
        _sum: { amountPaid: true },
      }),
      prisma.bespokeOrder.aggregate({
        where: { updatedAt: { gte: lastWeekStart, lte: lastWeekEnd } },
        _sum: { amountPaid: true },
      }),
      prisma.bespokeOrder.count({ where: { currentStage: { not: BespokeStage.DELIVERY } } }),
      prisma.bespokeOrder.count({
        where: {
          currentStage: { not: BespokeStage.DELIVERY },
          deliveryDate: { gte: now, lte: inSevenDays },
        },
      }),
      prisma.consultationBooking.count({ where: { createdAt: { gte: weekStart, lte: dayEnd } } }),
      prisma.consultationBooking.count({ where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd } } }),
      prisma.bespokeOrder.aggregate({
        where: { currentStage: { not: BespokeStage.DELIVERY }, balance: { gt: 0 } },
        _sum: { balance: true },
      }),
      prisma.bespokeOrder.count({
        where: { currentStage: { not: BespokeStage.DELIVERY }, balance: { gt: 0 } },
      }),
      prisma.activityLog.count({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          description: { contains: "Completed stage", mode: "insensitive" },
        },
      }),
      prisma.bespokeOrder.count({
        where: { deliveryDate: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, paidAt: { gte: dayStart, lte: dayEnd } },
        _sum: { total: true },
      }),
      prisma.consultationBooking.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, paidAt: { gte: dayStart, lte: dayEnd } },
        _sum: { feeNGN: true },
      }),
      prisma.consultationBooking.count({
        where: {
          status: ConsultationStatus.PENDING_CONFIRMATION,
          paymentStatus: PaymentStatus.PAID,
        },
      }),
      Promise.all(
        chartDays.map(async (d) => {
          const from = startOfDay(d);
          const to = endOfDay(d);
          const [rtw, bespoke, consult] = await Promise.all([
            prisma.order.aggregate({
              where: { paymentStatus: PaymentStatus.PAID, paidAt: { gte: from, lte: to }, isBespoke: false },
              _sum: { total: true },
            }),
            prisma.bespokeOrder.aggregate({
              where: { updatedAt: { gte: from, lte: to } },
              _sum: { amountPaid: true },
            }),
            prisma.consultationBooking.aggregate({
              where: { paymentStatus: PaymentStatus.PAID, paidAt: { gte: from, lte: to } },
              _sum: { feeNGN: true },
            }),
          ]);
          return {
            label: DAY_LABELS[d.getDay()],
            bespoke: bespoke._sum.amountPaid ?? 0,
            rtw: rtw._sum.total ?? 0,
            consultations: consult._sum.feeNGN ?? 0,
          };
        }),
      ),
      prisma.staffProfile.findMany({
        where: { isActive: true },
        take: 12,
        include: {
          user: { select: { name: true, email: true } },
          attendanceLogs: {
            where: { date: dayStart },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    revenueThisWeek =
      (rtwWeek._sum.total ?? 0) +
      (consultPaidWeek._sum.feeNGN ?? 0) +
      (bespokePaidWeek._sum.amountPaid ?? 0);
    revenueLastWeek =
      (rtwLastWeek._sum.total ?? 0) +
      (consultPaidLastWeek._sum.feeNGN ?? 0) +
      (bespokePaidLastWeek._sum.amountPaid ?? 0);
    activeCommissions = activeCount;
    nearingDelivery = nearCount;
    consultationsThisWeek = consultBookedWeek;
    consultationsLastWeek = consultBookedLastWeek;
    outstandingBalance = balanceAgg._sum.balance ?? 0;
    outstandingOrders = balanceOrders;
    ordersAdvancedToday = stageLogsToday;
    deliveriesToday = deliveryTodayCount;
    paymentsToday = (orderPaidToday._sum.total ?? 0) + (consultPaidToday._sum.feeNGN ?? 0);
    confirmationsPending = pendingConfirm;
    revenueChart = chartData;

    const resumptionSetting = await prisma.siteSetting.findUnique({ where: { key: "hr_resumption_time" } });
    const resumptionTime = resumptionSetting?.value ?? "09:00";
    const [resHour, resMin] = resumptionTime.split(":").map((n) => Number.parseInt(n, 10));
    const resumptionDate = new Date(dayStart);
    resumptionDate.setHours(resHour ?? 9, resMin ?? 0, 0, 0);

    for (const member of staffList) {
      if (member.employmentType === EmploymentType.FREELANCER) continue;
      const log = member.attendanceLogs[0];
      const name = member.user.name ?? member.user.email;
      const isIn = Boolean(log?.clockIn && !log?.clockOut);
      if (isIn) {
        attendanceOnClock += 1;
        const late = log!.clockIn! > resumptionDate && now >= resumptionDate;
        staffRows.push({
          name,
          initials: getInitials(name),
          status: "in",
          time: log!.clockIn!.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          badge: late ? "● Late · " + log!.clockIn!.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : `● In · ${log!.clockIn!.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
        });
      } else {
        attendanceLateOrAbsent += 1;
        staffRows.push({
          name,
          initials: getInitials(name),
          status: "out",
          badge: "● Not in",
        });
      }
    }
  } catch {
    /* DB unavailable */
  }

  const revenueTrendPct =
    revenueLastWeek === 0
      ? revenueThisWeek > 0
        ? 100
        : 0
      : Math.round(((revenueThisWeek - revenueLastWeek) / revenueLastWeek) * 100);
  const consultDelta = consultationsThisWeek - consultationsLastWeek;
  const chartTotal = revenueChart.reduce((a, d) => a + d.bespoke + d.rtw + d.consultations, 0);
  const greeting = greetingForHour(now.getHours());
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg bg-wine px-7 py-7 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-cream/70">
              Daily report · {dateLabel}
            </p>
            <h2 className="mt-2 font-serif text-[28px] font-normal text-cream md:text-[32px]">
              {greeting}, Mrs. Prudent.
            </h2>
            <p className="mt-3 font-sans text-[13px] text-cream/80">
              {ordersAdvancedToday} orders advanced · {deliveriesToday} delivery scheduled today ·{" "}
              {formatNGN(paymentsToday)} received · {confirmationsPending} confirmations pending
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="inline-flex shrink-0 items-center justify-center rounded-sm border border-gold px-5 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-gold transition-colors hover:bg-gold/10"
          >
            ↓ Download report
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveKPICard
          label="Revenue · This week"
          value={formatNGN(revenueThisWeek)}
          trend={`${Math.abs(revenueTrendPct)}% vs last week`}
          trendUp={revenueTrendPct >= 0 ? true : revenueTrendPct < 0 ? false : null}
          icon={TrendingUp}
          iconBg="bg-sand/40"
        />
        <ExecutiveKPICard
          label="Active commissions"
          value={String(activeCommissions)}
          trend={`${nearingDelivery} nearing delivery`}
          trendUp={null}
          icon={Scissors}
          iconBg="bg-lightbr/30"
        />
        <ExecutiveKPICard
          label="Consultations booked"
          value={String(consultationsThisWeek)}
          trend={consultDelta >= 0 ? `+${consultDelta} this week` : `${consultDelta} this week`}
          trendUp={consultDelta >= 0}
          icon={CalendarDays}
          iconBg="bg-nut/15"
        />
        <ExecutiveKPICard
          label="Outstanding balance"
          value={formatNGN(outstandingBalance)}
          trend={`across ${outstandingOrders} orders`}
          trendUp={null}
          icon={CreditCard}
          iconBg="bg-wine/10"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ExecutiveRevenueChart data={revenueChart} total={chartTotal} />
        </div>

        <div className="card-surface p-6">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
            Attendance · Today
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-sm bg-success/10 px-4 py-3">
              <p className="font-serif text-2xl text-choc">{attendanceOnClock}</p>
              <p className="mt-1 font-sans text-[11px] text-text-mid">On the clock</p>
            </div>
            <div className="rounded-sm bg-warning/10 px-4 py-3">
              <p className="font-serif text-2xl text-choc">{attendanceLateOrAbsent}</p>
              <p className="mt-1 font-sans text-[11px] text-text-mid">Late / not in</p>
            </div>
          </div>
          <ul className="mt-5 max-h-64 space-y-3 overflow-y-auto">
            {staffRows.length === 0 ? (
              <li className="font-sans text-sm text-text-mid">No staff records for today.</li>
            ) : (
              staffRows.slice(0, 8).map((row) => (
                <li key={row.name} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand/50 font-sans text-[10px] font-medium text-choc">
                    {row.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-[12px] text-choc">{row.name}</p>
                    <p
                      className={`font-sans text-[10px] ${row.status === "in" ? "text-success" : "text-danger"}`}
                    >
                      {row.badge}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
          <Link
            href="/admin/attendance"
            className="mt-4 inline-block font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-nut"
          >
            View all attendance
          </Link>
        </div>
      </div>
    </div>
  );
}
