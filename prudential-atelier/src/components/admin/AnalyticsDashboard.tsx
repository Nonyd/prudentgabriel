"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import { TrendingUp, ShoppingBag, Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DailyRevenuePoint = { date: string; label: string; amount: number };

export type RecentOrderRow = {
  id: string;
  orderNumber: string;
  customerLabel: string;
  itemSummary: string;
  total: number;
  gateway: PaymentGateway | null;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
};

export type BespokeAlertRow = {
  id: string;
  requestNumber: string;
  name: string;
  occasion: string;
  createdAt: string;
};

export type CouponExpiringRow = {
  id: string;
  code: string;
  expiresAt: string;
  remainingUses: string;
};

type AnalyticsDashboardProps = {
  revenue30: number;
  revenuePrev30: number;
  orders30Count: number;
  ordersPendingPayment: number;
  newCustomers30: number;
  newCustomersReferral30: number;
  pendingBespoke: number;
  pendingReviews: number;
  pendingOrdersFulfilment: number;
  chartData: DailyRevenuePoint[];
  recentOrders: RecentOrderRow[];
  bespokePendingList: BespokeAlertRow[];
  expiringCoupons: CouponExpiringRow[];
};

function formatNGN(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function yAxisMoney(v: number): string {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `₦${(v / 1000).toFixed(0)}k`;
  return `₦${Math.round(v)}`;
}

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "DELIVERED":
    case "COLLECTED":
      return "bg-success-soft text-success";
    case "SHIPPED":
    case "READY_FOR_COLLECTION":
      return "bg-info-soft text-info";
    case "PROCESSING":
      return "bg-warning-soft text-warning";
    case "CONFIRMED":
      return "bg-info-soft text-[#1A5FAD]";
    case "PENDING":
      return "bg-warning-soft text-warning";
    case "CANCELLED":
    case "REFUNDED":
      return "bg-error-soft text-error";
    default:
      return "bg-bg-page text-text-light";
  }
}

function paymentBadgeClass(s: PaymentStatus): string {
  switch (s) {
    case "PAID":
      return "bg-success-soft text-success";
    case "PENDING":
      return "bg-warning-soft text-warning";
    case "FAILED":
      return "bg-error-soft text-error";
    case "REFUNDED":
      return "bg-info-soft text-info";
    default:
      return "bg-bg-page text-text-light";
  }
}

function gatewayBadgeClass(g: PaymentGateway | null): string {
  switch (g) {
    case "PAYSTACK":
      return "bg-success-soft text-success";
    case "FLUTTERWAVE":
      return "bg-info-soft text-info";
    case "STRIPE":
      return "bg-info-soft text-info";
    case "MONNIFY":
      return "bg-warning-soft text-warning";
    default:
      return "bg-bg-page text-text-light";
  }
}

export function AnalyticsDashboard({
  revenue30,
  revenuePrev30,
  orders30Count,
  ordersPendingPayment,
  newCustomers30,
  newCustomersReferral30,
  pendingBespoke,
  pendingReviews,
  pendingOrdersFulfilment,
  chartData,
  recentOrders,
  bespokePendingList,
  expiringCoupons,
}: AnalyticsDashboardProps) {
  const growth =
    revenuePrev30 > 0 ? ((revenue30 - revenuePrev30) / revenuePrev30) * 100 : revenue30 > 0 ? 100 : 0;
  const pendingActions = pendingBespoke + pendingReviews + pendingOrdersFulfilment;
  const urgentHref =
    pendingBespoke > 0
      ? "/admin/bespoke"
      : pendingReviews > 0
        ? "/admin/reviews"
        : pendingOrdersFulfilment > 0
          ? "/admin/orders"
          : "/admin";

  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-28px text-ink">Dashboard</h1>
          <p className="mt-1 font-body text-xs font-light text-text-mid">{todayLabel}</p>
        </div>
        <span className="inline-flex w-fit border border-sand px-3 py-1 font-body text-11px text-text-mid">
          Last 30 days
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative border border-sand bg-canvas p-6">
          <div className="flex items-start justify-between">
            <p className="font-body text-10px font-medium uppercase tracking-wide text-text-light">Revenue (30 days)</p>
            <TrendingUp className="h-4 w-4 shrink-0 text-text-light" aria-hidden />
          </div>
          <p className="mt-2 font-display text-32px text-ink">{formatNGN(revenue30)}</p>
          <p className={cn("mt-1 font-body text-xs font-light", growth >= 0 ? "text-olive" : "text-error")}>
            {growth >= 0 ? "+" : ""}
            {growth.toFixed(1)}% vs prev 30 days
          </p>
        </div>
        <div className="border border-sand bg-canvas p-6">
          <div className="flex items-start justify-between">
            <p className="font-body text-10px font-medium uppercase tracking-wide text-text-light">Total orders (30 days)</p>
            <ShoppingBag className="h-4 w-4 shrink-0 text-text-light" aria-hidden />
          </div>
          <p className="mt-2 font-display text-32px text-ink">{orders30Count}</p>
          <p className="mt-1 font-body text-xs font-light text-text-mid">{ordersPendingPayment} pending payment</p>
        </div>
        <div className="border border-sand bg-canvas p-6">
          <div className="flex items-start justify-between">
            <p className="font-body text-10px font-medium uppercase tracking-wide text-text-light">New customers (30 days)</p>
            <Users className="h-4 w-4 shrink-0 text-text-light" aria-hidden />
          </div>
          <p className="mt-2 font-display text-32px text-ink">{newCustomers30}</p>
          <p className="mt-1 font-body text-xs font-light text-text-mid">{newCustomersReferral30} via referral</p>
        </div>
        <Link
          href={urgentHref}
          className="block border border-sand bg-canvas p-6 transition-colors hover:bg-bg-page"
        >
          <div className="flex items-start justify-between">
            <p className="font-body text-10px font-medium uppercase tracking-wide text-text-light">Pending actions</p>
            <AlertCircle className="h-4 w-4 shrink-0 text-text-light" aria-hidden />
          </div>
          <p className={cn("mt-2 font-display text-32px", pendingActions > 0 ? "text-error" : "text-ink")}>
            {pendingActions}
          </p>
          <p className="mt-1 font-body text-xs font-light text-text-mid">
            {pendingBespoke} atelier · {pendingReviews} reviews · {pendingOrdersFulfilment} orders
          </p>
        </Link>
      </div>

      <div className="border border-sand bg-canvas p-6">
        <h2 className="mb-4 font-body text-xs font-medium uppercase tracking-wide text-ink">Revenue</h2>
        <div className="h-[280px] min-h-[300px] w-full" style={{ width: "100%", height: 300, minHeight: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revOlive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#37392d" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#37392d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#A8A8A4", fontSize: 11, fontFamily: "var(--font-jost)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={yAxisMoney}
                tick={{ fill: "#A8A8A4", fontSize: 11, fontFamily: "var(--font-jost)" }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return [`₦${n.toLocaleString("en-NG")}`, "Revenue"];
                }}
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid #EBEBEA",
                  borderRadius: 0,
                  fontFamily: "var(--font-jost)",
                  fontSize: 12,
                  color: "#0A0A0A",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#37392d"
                strokeWidth={1.5}
                fill="url(#revOlive)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden border border-sand bg-canvas">
        <div className="flex items-center justify-between border-b border-sand px-6 py-4">
          <h2 className="font-body text-xs font-medium uppercase tracking-wide text-ink">Recent Orders</h2>
          <Link href="/admin/orders" className="font-body text-11px text-olive hover:underline">
            View All →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-sand bg-bg-page font-body text-10px font-medium uppercase tracking-wide text-text-light">
                <th className="px-6 py-2.5">Order #</th>
                <th className="px-6 py-2.5">Customer</th>
                <th className="px-6 py-2.5">Items</th>
                <th className="px-6 py-2.5">Total</th>
                <th className="px-6 py-2.5">Gateway</th>
                <th className="px-6 py-2.5">Status</th>
                <th className="px-6 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-border transition-colors hover:bg-bg-page">
                  <td className="px-6 py-3.5">
                    <Link href={`/admin/orders/${o.id}`} className="font-body text-11px font-medium text-olive hover:underline">
                      #{o.orderNumber}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-6 py-3.5 font-body text-13px text-ink">{o.customerLabel}</td>
                  <td className="max-w-[200px] truncate px-6 py-3.5 font-body text-13px text-text-mid">{o.itemSummary}</td>
                  <td className="px-6 py-3.5 font-body text-13px text-ink">{formatNGN(o.total)}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 font-body text-9px font-medium uppercase",
                        gatewayBadgeClass(o.gateway),
                      )}
                    >
                      {o.gateway ?? "—"}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 font-body text-9px font-medium uppercase",
                        statusBadgeClass(o.status),
                      )}
                    >
                      {o.status}
                    </span>
                    <span
                      className={cn(
                        "ml-1 inline-block px-2 py-0.5 font-body text-9px font-medium uppercase",
                        paymentBadgeClass(o.paymentStatus),
                      )}
                    >
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-body text-13px text-text-light" title={new Date(o.createdAt).toISOString()}>
                    {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-sand bg-canvas p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-body text-11px font-medium uppercase tracking-wide text-ink">Atelier requests</h3>
            {bespokePendingList.length > 0 ? (
              <span className="bg-warning-soft px-2 py-0.5 font-body text-9px text-warning">{bespokePendingList.length}</span>
            ) : null}
          </div>
          <ul className="mt-4 divide-y divide-[#F5F5F3]">
            {bespokePendingList.slice(0, 5).map((b) => (
              <li key={b.id} className="py-3 font-body text-xs text-ink">
                <span className="font-medium text-olive">#{b.requestNumber}</span> · {b.name} · {b.occasion}
                <span className="mt-1 block font-body text-11px text-text-mid">
                  {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/bespoke" className="mt-4 inline-block font-body text-11px text-olive hover:underline">
            Review all
          </Link>
        </div>
        <div className="border border-sand bg-canvas p-5">
          <h3 className="font-body text-11px font-medium uppercase tracking-wide text-ink">Coupons expiring soon</h3>
          <p className="mt-1 font-body text-11px text-text-mid">Within 7 days</p>
          <ul className="mt-4 divide-y divide-[#F5F5F3]">
            {expiringCoupons.length === 0 ? (
              <li className="py-3 font-body text-xs text-success">No coupons expiring soon ✓</li>
            ) : (
              expiringCoupons.map((c) => (
                <li key={c.id} className="py-3 font-body text-xs text-ink">
                  <span className="font-mono text-olive">{c.code}</span> · {new Date(c.expiresAt).toLocaleDateString()} · {c.remainingUses}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
