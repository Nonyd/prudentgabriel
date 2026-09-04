import Link from "next/link";
import { OrderStatus, PaymentStatus, Prisma, ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminOrdersCsvExport } from "@/components/admin/AdminOrdersCsvExport";
import { AdminOrdersListClient, type AdminOrderListRow } from "@/components/admin/AdminOrdersListClient";
import { REFUND_REQUIRED_ATTENTION, QUOTE_PENDING_ATTENTION, QUOTE_PENDING_ALL_ATTENTION, GUEST_CUSTOM_ATTENTION, BANK_TRANSFER_PENDING_ATTENTION, applyOrderAttention } from "@/lib/admin-orders-filter";

const PAGE = 20;

type SP = Record<string, string | string[] | undefined>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const search = (Array.isArray(sp.search) ? sp.search[0] : sp.search)?.trim() ?? "";
  const status = (Array.isArray(sp.status) ? sp.status[0] : sp.status) ?? "";
  const paymentStatus = (Array.isArray(sp.paymentStatus) ? sp.paymentStatus[0] : sp.paymentStatus) ?? "";
  const attention = (Array.isArray(sp.attention) ? sp.attention[0] : sp.attention) ?? "";

  let where: Prisma.OrderWhereInput = {};
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { guestEmail: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status && (Object.values(OrderStatus) as string[]).includes(status)) {
    where.status = status as OrderStatus;
  }
  if (paymentStatus && (Object.values(PaymentStatus) as string[]).includes(paymentStatus)) {
    where.paymentStatus = paymentStatus as PaymentStatus;
  }
  where = applyOrderAttention(where, attention);

  const [total, orders, refundRequiredCount, quoteReadyCount, quotePendingAllCount, guestCustomCount, bankTransferCount] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        _count: { select: { items: true } },
        items: { take: 1, include: { product: { select: { name: true } } } },
      },
    }),
    prisma.order.count({
      where: { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.PAID, refundRecordedAt: null },
    }),
    prisma.order.count({
      where: { shippingQuoteStatus: ShippingQuoteStatus.QUOTE_PENDING, status: OrderStatus.PROCESSING },
    }),
    prisma.order.count({
      where: { shippingQuoteStatus: ShippingQuoteStatus.QUOTE_PENDING },
    }),
    prisma.order.count({
      where: { guestCustom: true },
    }),
    prisma.order.count({
      where: { paymentGateway: "BANK_TRANSFER", paymentStatus: PaymentStatus.PENDING },
    }),
  ]);

  function pageHref(p: number) {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (paymentStatus) q.set("paymentStatus", paymentStatus);
    if (attention) q.set("attention", attention);
    q.set("page", String(p));
    return `/admin/orders?${q.toString()}`;
  }

  const exportQuery = new URLSearchParams();
  if (search) exportQuery.set("search", search);
  if (status) exportQuery.set("status", status);
  if (paymentStatus) exportQuery.set("paymentStatus", paymentStatus);
  if (attention) exportQuery.set("attention", attention);

  const listRows: AdminOrderListRow[] = orders.map((o) => {
    const email = o.user?.email ?? o.guestEmail ?? "";
    const name = o.user?.name ?? o.guestName ?? "Guest";
    const first = o.items[0]?.product.name ?? "—";
    const snap = o.addressSnapshot as { phone?: string } | null;
    const phone = o.user?.phone || o.guestPhone || snap?.phone || null;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      itemCount: o._count.items,
      firstItemName: first,
      total: o.total,
      paymentGateway: o.paymentGateway,
      paymentStatus: o.paymentStatus,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-charcoal">Orders</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/orders?attention=${QUOTE_PENDING_ATTENTION}`}
            className={`font-body text-[11px] uppercase tracking-wide ${
              attention === QUOTE_PENDING_ATTENTION ? "text-choc underline" : "text-olive hover:underline"
            }`}
          >
            Ready to quote{quoteReadyCount > 0 ? ` (${quoteReadyCount})` : ""}
          </Link>
          <Link
            href={`/admin/orders?attention=${QUOTE_PENDING_ALL_ATTENTION}`}
            className={`font-body text-[11px] uppercase tracking-wide ${
              attention === QUOTE_PENDING_ALL_ATTENTION ? "text-choc underline" : "text-olive hover:underline"
            }`}
          >
            All awaiting quote{quotePendingAllCount > 0 ? ` (${quotePendingAllCount})` : ""}
          </Link>
          <Link
            href={`/admin/orders?attention=${REFUND_REQUIRED_ATTENTION}`}
            className={`font-body text-[11px] uppercase tracking-wide ${
              attention === REFUND_REQUIRED_ATTENTION ? "text-choc underline" : "text-olive hover:underline"
            }`}
          >
            Refund required{refundRequiredCount > 0 ? ` (${refundRequiredCount})` : ""}
          </Link>
          <Link
            href={`/admin/orders?attention=${GUEST_CUSTOM_ATTENTION}`}
            className={`font-body text-[11px] uppercase tracking-wide ${
              attention === GUEST_CUSTOM_ATTENTION ? "text-choc underline" : "text-olive hover:underline"
            }`}
          >
            Guest custom{guestCustomCount > 0 ? ` (${guestCustomCount})` : ""}
          </Link>
          <Link
            href={`/admin/orders?attention=${BANK_TRANSFER_PENDING_ATTENTION}`}
            className={`font-body text-[11px] uppercase tracking-wide ${
              attention === BANK_TRANSFER_PENDING_ATTENTION ? "text-choc underline" : "text-olive hover:underline"
            }`}
          >
            Bank proof{bankTransferCount > 0 ? ` (${bankTransferCount})` : ""}
          </Link>
          <AdminOrdersCsvExport query={exportQuery.toString()} />
        </div>
      </div>
      <form className="mt-6 flex flex-wrap gap-2 text-sm" method="get">
        <input
          name="search"
          defaultValue={search}
          placeholder="Order # or email"
          className="min-w-[200px] flex-1 rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
        />
        <select name="status" defaultValue={status} className="rounded-sm border border-sand bg-canvas px-2 py-2 text-charcoal">
          <option value="">All statuses</option>
          {Object.values(OrderStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="paymentStatus"
          defaultValue={paymentStatus}
          className="rounded-sm border border-sand bg-canvas px-2 py-2 text-charcoal"
        >
          <option value="">All payments</option>
          {Object.values(PaymentStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input type="hidden" name="attention" value={attention} />
        <button type="submit" className="bg-olive px-4 py-2 font-body text-xs uppercase tracking-wide text-white">
          Filter
        </button>
        {attention === REFUND_REQUIRED_ATTENTION ? (
          <Link href="/admin/orders" className="px-3 py-2 font-body text-xs uppercase tracking-wide text-olive hover:underline">
            Clear refund filter
          </Link>
        ) : null}
        {attention === QUOTE_PENDING_ATTENTION || attention === QUOTE_PENDING_ALL_ATTENTION ? (
          <Link href="/admin/orders" className="px-3 py-2 font-body text-xs uppercase tracking-wide text-olive hover:underline">
            Clear quote filter
          </Link>
        ) : null}
      </form>

      <div className="mt-8">
        <AdminOrdersListClient orders={listRows} />
      </div>

      <p className="mt-4 text-sm text-[#A8A8A4]">
        {total} orders · page {page} of {Math.max(1, Math.ceil(total / PAGE))}
      </p>
      <div className="mt-2 flex gap-2">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className="text-sm text-olive hover:underline">
            Previous
          </Link>
        ) : null}
        {page * PAGE < total ? (
          <Link href={pageHref(page + 1)} className="text-sm text-olive hover:underline">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
