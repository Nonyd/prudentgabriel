"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
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

export type OosRow = {
  productId: string;
  productName: string;
  slug: string;
  size: string;
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
  oosVariants: OosRow[];
  bespokePendingList: BespokeAlertRow[];
  expiringCoupons: CouponExpiringRow[];
};

function formatNGN(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "DELIVERED":
      return "bg-emerald-500/15 text-emerald-300";
    case "SHIPPED":
      return "bg-blue-500/15 text-blue-300";
    case "PROCESSING":
    case "CONFIRMED":
      return "bg-gold/15 text-gold";
    case "PENDING":
      return "bg-amber-500/15 text-amber-200";
    case "CANCELLED":
    case "REFUNDED":
      return "bg-red-500/15 text-red-300";
    default:
      return "bg-[#252525] text-[#8A8A8A]";
  }
}

function paymentBadgeClass(s: PaymentStatus): string {
  switch (s) {
    case "PAID":
      return "bg-emerald-500/15 text-emerald-300";
    case "PENDING":
      return "bg-amber-500/15 text-amber-200";
    case "FAILED":
      return "bg-red-500/15 text-red-300";
    case "REFUNDED":
      return "bg-violet-500/15 text-violet-200";
    default:
      return "bg-[#252525] text-[#8A8A8A]";
  }
}

function gatewayBadgeClass(g: PaymentGateway | null): string {
  switch (g) {
    case "PAYSTACK":
      return "bg-emerald-500/15 text-emerald-300";
    case "FLUTTERWAVE":
      return "bg-sky-500/15 text-sky-300";
    case "STRIPE":
      return "bg-violet-500/15 text-violet-200";
    case "MONNIFY":
      return "bg-orange-500/15 text-orange-200";
    default:
      return "bg-[#252525] text-[#8A8A8A]";
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
  oosVariants,
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

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative rounded-sm border border-gold/10 bg-[#1E1E1E] p-6">
          <p className="font-label text-xs uppercase tracking-wide text-[#8A8A8A]">Revenue (30 days)</p>
          <p className="mt-2 font-display text-3xl text-white">{formatNGN(revenue30)}</p>
          <p className={cn("mt-1 text-sm", growth >= 0 ? "text-emerald-400" : "text-red-400")}>
            {growth >= 0 ? "+" : ""}
            {growth.toFixed(1)}% vs prev 30 days
          </p>
          <TrendingUp className="absolute right-5 top-5 h-6 w-6 text-gold/80" aria-hidden />
        </div>
        <div className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-6">
          <p className="font-label text-xs uppercase tracking-wide text-[#8A8A8A]">Total orders (30 days)</p>
          <p className="mt-2 font-display text-3xl text-white">{orders30Count} orders</p>
          <p className="mt-1 text-sm text-[#8A8A8A]">{ordersPendingPayment} pending payment</p>
          <ShoppingBag className="float-right -mt-10 h-6 w-6 text-gold/50" aria-hidden />
        </div>
        <div className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-6">
          <p className="font-label text-xs uppercase tracking-wide text-[#8A8A8A]">New customers (30 days)</p>
          <p className="mt-2 font-display text-3xl text-white">{newCustomers30}</p>
          <p className="mt-1 text-sm text-[#8A8A8A]">{newCustomersReferral30} via referral</p>
          <Users className="float-right -mt-10 h-6 w-6 text-gold/50" aria-hidden />
        </div>
        <Link
          href={urgentHref}
          className="block rounded-sm border border-gold/10 bg-[#1E1E1E] p-6 transition-colors hover:border-gold/30"
        >
          <p className="font-label text-xs uppercase tracking-wide text-[#8A8A8A]">Pending actions</p>
          <p className={cn("mt-2 font-display text-3xl", pendingActions > 0 ? "text-red-400" : "text-white")}>
            {pendingActions}
          </p>
          <p className="mt-1 text-sm text-[#8A8A8A]">
            {pendingBespoke} bespoke · {pendingReviews} reviews · {pendingOrdersFulfilment} orders
          </p>
          <AlertCircle className="float-right -mt-10 h-6 w-6 text-gold/50" aria-hidden />
        </Link>
      </div>

      <div className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-6">
        <h2 className="font-display text-lg text-ivory">Revenue</h2>
        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="label" tick={{ fill: "#8A8A8A", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                tick={{ fill: "#8A8A8A", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#252525",
                  border: "1px solid rgba(201,168,76,0.35)",
                  borderRadius: 4,
                  color: "#FAF6EF",
                }}
                formatter={(value) => [formatNGN(Number(value)), "Revenue"]}
              />
              <Area type="monotone" dataKey="amount" stroke="#C9A84C" strokeWidth={2} fill="url(#revGold)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-ivory">Recent orders</h2>
          <Link href="/admin/orders" className="font-label text-xs uppercase tracking-wide text-gold hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gold/10 font-label text-[11px] uppercase tracking-wide text-[#8A8A8A]">
                <th className="pb-3 pr-3">Order #</th>
                <th className="pb-3 pr-3">Customer</th>
                <th className="pb-3 pr-3">Items</th>
                <th className="pb-3 pr-3">Total</th>
                <th className="pb-3 pr-3">Gateway</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-gold/5 transition-colors hover:bg-[#252525]"
                >
                  <td className="py-3 pr-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-label text-gold hover:underline">
                      #{o.orderNumber}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate py-3 pr-3 text-ivory/90">{o.customerLabel}</td>
                  <td className="max-w-[200px] truncate py-3 pr-3 text-[#8A8A8A]">{o.itemSummary}</td>
                  <td className="py-3 pr-3 text-ivory">{formatNGN(o.total)}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={cn(
                        "inline-block rounded-sm px-2 py-0.5 font-label text-[10px] uppercase",
                        gatewayBadgeClass(o.gateway),
                      )}
                    >
                      {o.gateway ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={cn(
                        "inline-block rounded-sm px-2 py-0.5 font-label text-[10px] uppercase",
                        statusBadgeClass(o.status),
                      )}
                    >
                      {o.status}
                    </span>
                    <span
                      className={cn(
                        "ml-1 inline-block rounded-sm px-2 py-0.5 font-label text-[10px] uppercase",
                        paymentBadgeClass(o.paymentStatus),
                      )}
                    >
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3 text-[#8A8A8A]" title={new Date(o.createdAt).toISOString()}>
                    {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-ivory">Out of stock</h3>
            {oosVariants.length > 0 ? (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">{oosVariants.length}</span>
            ) : null}
          </div>
          <ul className="mt-4 space-y-3">
            {oosVariants.length === 0 ? (
              <li className="text-sm text-emerald-400">All variants are in stock ✓</li>
            ) : (
              oosVariants.map((r, i) => (
                <li key={`${r.slug}-${r.size}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ivory/90">
                    {r.productName}{" "}
                    <span className="text-[#8A8A8A]">({r.size})</span>
                  </span>
                  <Link href={`/admin/products/${r.productId}/edit`} className="shrink-0 text-gold hover:underline">
                    Edit
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-ivory">Bespoke requests</h3>
            {bespokePendingList.length > 0 ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                {bespokePendingList.length}
              </span>
            ) : null}
          </div>
          <ul className="mt-4 space-y-3">
            {bespokePendingList.slice(0, 5).map((b) => (
              <li key={b.id} className="text-sm text-ivory/90">
                <span className="font-label text-gold">#{b.requestNumber}</span> · {b.name} · {b.occasion}
                <span className="block text-xs text-[#8A8A8A]">
                  {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/bespoke" className="mt-4 inline-block text-sm text-gold hover:underline">
            Review all
          </Link>
        </div>
        <div className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-5">
          <h3 className="font-display text-base text-ivory">Coupons expiring soon</h3>
          <p className="mt-1 text-xs text-[#8A8A8A]">Within 7 days</p>
          <ul className="mt-4 space-y-3">
            {expiringCoupons.length === 0 ? (
              <li className="text-sm text-emerald-400">No coupons expiring soon ✓</li>
            ) : (
              expiringCoupons.map((c) => (
                <li key={c.id} className="text-sm text-ivory/90">
                  <span className="font-mono text-gold">{c.code}</span> · {new Date(c.expiresAt).toLocaleDateString()}{" "}
                  · {c.remainingUses}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
