import Link from "next/link";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminOrdersCsvExport } from "@/components/admin/AdminOrdersCsvExport";
import { AdminOrdersListClient, type AdminOrderListRow } from "@/components/admin/AdminOrdersListClient";

const PAGE = 20;

type SP = Record<string, string | string[] | undefined>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const search = (Array.isArray(sp.search) ? sp.search[0] : sp.search)?.trim() ?? "";
  const status = (Array.isArray(sp.status) ? sp.status[0] : sp.status) ?? "";
  const paymentStatus = (Array.isArray(sp.paymentStatus) ? sp.paymentStatus[0] : sp.paymentStatus) ?? "";

  const where: Prisma.OrderWhereInput = {};
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

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
        items: { take: 1, include: { product: { select: { name: true } } } },
      },
    }),
  ]);

  function pageHref(p: number) {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (paymentStatus) q.set("paymentStatus", paymentStatus);
    q.set("page", String(p));
    return `/admin/orders?${q.toString()}`;
  }

  const exportQuery = new URLSearchParams();
  if (search) exportQuery.set("search", search);
  if (status) exportQuery.set("status", status);
  if (paymentStatus) exportQuery.set("paymentStatus", paymentStatus);

  const listRows: AdminOrderListRow[] = orders.map((o) => {
    const email = o.user?.email ?? o.guestEmail ?? "";
    const name = o.user?.name ?? o.guestName ?? "Guest";
    const first = o.items[0]?.product.name ?? "—";
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: name,
      customerEmail: email,
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
        <AdminOrdersCsvExport query={exportQuery.toString()} />
      </div>
      <form className="mt-6 flex flex-wrap gap-2 text-sm" method="get">
        <input
          name="search"
          defaultValue={search}
          placeholder="Order # or email"
          className="min-w-[200px] flex-1 rounded-sm border border-[#EBEBEA] bg-canvas px-3 py-2 text-charcoal"
        />
        <select name="status" defaultValue={status} className="rounded-sm border border-[#EBEBEA] bg-canvas px-2 py-2 text-charcoal">
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
          className="rounded-sm border border-[#EBEBEA] bg-canvas px-2 py-2 text-charcoal"
        >
          <option value="">All payments</option>
          {Object.values(PaymentStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-olive px-4 py-2 font-body text-xs uppercase tracking-wide text-white">
          Filter
        </button>
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
