import Link from "next/link";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminOrdersCsvExport } from "@/components/admin/AdminOrdersCsvExport";

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-ivory">Orders</h1>
        <AdminOrdersCsvExport query={exportQuery.toString()} />
      </div>
      <form className="mt-6 flex flex-wrap gap-2 text-sm" method="get">
        <input
          name="search"
          defaultValue={search}
          placeholder="Order # or email"
          className="min-w-[200px] flex-1 rounded-sm border border-gold/15 bg-[#1E1E1E] px-3 py-2 text-ivory"
        />
        <select name="status" defaultValue={status} className="rounded-sm border border-gold/15 bg-[#1E1E1E] px-2 py-2 text-ivory">
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
          className="rounded-sm border border-gold/15 bg-[#1E1E1E] px-2 py-2 text-ivory"
        >
          <option value="">All payments</option>
          {Object.values(PaymentStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-sm bg-wine px-4 py-2 text-gold">
          Filter
        </button>
      </form>

      <div className="-mx-4 mt-8 overflow-x-auto rounded-sm border border-gold/10 bg-[#1E1E1E] px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[700px] text-left text-sm text-ivory/90">
          <thead className="border-b border-gold/10 text-[11px] uppercase text-[#8A8A8A]">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="hidden p-3 md:table-cell">Items</th>
              <th className="p-3">Total</th>
              <th className="hidden p-3 lg:table-cell">Gateway</th>
              <th className="hidden p-3 md:table-cell">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const email = o.user?.email ?? o.guestEmail ?? "";
              const name = o.user?.name ?? o.guestName ?? "Guest";
              const first = o.items[0]?.product.name ?? "—";
              return (
                <tr key={o.id} className="border-b border-gold/5 hover:bg-[#252525]">
                  <td className="p-3 font-label text-gold">{o.orderNumber}</td>
                  <td className="p-3">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-[#8A8A8A]">{email}</div>
                  </td>
                  <td className="hidden p-3 text-xs md:table-cell">
                    {o._count.items} · {first}
                  </td>
                  <td className="p-3">₦{Math.round(o.total).toLocaleString("en-NG")}</td>
                  <td className="hidden p-3 text-xs lg:table-cell">{o.paymentGateway ?? "—"}</td>
                  <td className="hidden p-3 text-xs md:table-cell">{o.paymentStatus}</td>
                  <td className="p-3 text-xs">{o.status}</td>
                  <td className="p-3 text-xs text-[#8A8A8A]">{o.createdAt.toLocaleDateString("en-NG")}</td>
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-gold hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-[#8A8A8A]">
        {total} orders · page {page} of {Math.max(1, Math.ceil(total / PAGE))}
      </p>
      <div className="mt-2 flex gap-2">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className="text-sm text-gold">
            Previous
          </Link>
        ) : null}
        {page * PAGE < total ? (
          <Link href={pageHref(page + 1)} className="text-sm text-gold">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
