import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminCustomerPointsForm } from "@/components/admin/AdminCustomerPointsForm";
import { getPointRateNGN, pointsToNaira } from "@/lib/points";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, role: Role.CUSTOMER },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 10 },
      pointsHistory: { orderBy: { createdAt: "desc" }, take: 15 },
      addresses: true,
    },
  });
  if (!user) notFound();

  const [spent, rateNGN] = await Promise.all([
    prisma.order.aggregate({
      where: { userId: id, paymentStatus: "PAID" },
      _sum: { total: true },
    }),
    getPointRateNGN(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/admin/customers" className="text-sm text-[#A8A8A4] hover:text-gold">
        ← Customers
      </Link>
      <div>
        <h1 className="font-display text-2xl text-charcoal">{user.name}</h1>
        <p className="text-sm text-[#A8A8A4]">{user.email}</p>
        <p className="mt-2 text-sm text-charcoal-mid">
          Points: {user.pointsBalance.toLocaleString()} ({"₦"}
          {Math.round(pointsToNaira(user.pointsBalance, rateNGN)).toLocaleString("en-NG")}) · Orders:{" "}
          {user.orders.length} · Spent: ₦{Math.round(spent._sum.total ?? 0).toLocaleString("en-NG")}
        </p>
      </div>
      <AdminCustomerPointsForm userId={user.id} currentBalance={user.pointsBalance} />
      <div className="rounded-sm border border-sand bg-canvas p-6">
        <h2 className="font-display text-lg text-gold">Recent orders</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {user.orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="text-gold hover:underline">
                {o.orderNumber}
              </Link>{" "}
              — {o.status} — ₦{Math.round(o.total).toLocaleString("en-NG")}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-sm border border-sand bg-canvas p-6">
        <h2 className="font-display text-lg text-gold">Points history</h2>
        <ul className="mt-3 space-y-2 text-xs text-charcoal-mid">
          {user.pointsHistory.map((p) => (
            <li key={p.id}>
              {p.type}: {p.amount} — {p.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
