import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export default async function AdminCustomersPage() {
  const users = await prisma.user.findMany({
    where: { role: Role.CUSTOMER },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      _count: { select: { orders: true, referrals: true } },
    },
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Customers</h1>
      <div className="-mx-4 mt-8 overflow-x-auto rounded-sm border border-gold/10 bg-[#1E1E1E] px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[700px] text-left text-sm text-ivory/90">
          <thead className="text-[#8A8A8A]">
            <tr>
              <th className="p-3">Name</th>
              <th className="hidden p-3 sm:table-cell">Email</th>
              <th className="hidden p-3 md:table-cell">Points</th>
              <th className="p-3">Orders</th>
              <th className="hidden p-3 md:table-cell">Referrals</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gold/10">
                <td className="p-3">
                  <div>{u.name}</div>
                  <div className="text-xs text-[#8A8A8A] sm:hidden">{u.email}</div>
                </td>
                <td className="hidden p-3 text-xs sm:table-cell">{u.email}</td>
                <td className="hidden p-3 md:table-cell">{u.pointsBalance}</td>
                <td className="p-3">{u._count.orders}</td>
                <td className="hidden p-3 md:table-cell">{u._count.referrals}</td>
                <td className="p-3">
                  <Link href={`/admin/customers/${u.id}`} className="text-gold hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
