import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

export async function AdminOutstandingBalances() {
  const orders = await prisma.bespokeOrder.findMany({
    where: { balance: { gt: 0 } },
    orderBy: [{ balance: "desc" }, { deliveryDate: "asc" }],
    take: 25,
    select: {
      id: true,
      orderRef: true,
      clientName: true,
      totalAmount: true,
      amountPaid: true,
      balance: true,
      deliveryDate: true,
    },
  });

  if (orders.length === 0) return null;

  const totalOutstanding = orders.reduce((sum, o) => sum + o.balance, 0);

  return (
    <section className="mt-8 border border-[#EBEBEA] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink">Outstanding balances</h2>
          <p className="mt-1 font-body text-sm text-[#6B6B68]">
            Bespoke orders with balance due · Total {formatPrice(totalOutstanding, "NGN")}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse font-body text-sm">
          <thead>
            <tr className="border-b border-[#EBEBEA] bg-[#FAFAFA] text-left text-[10px] font-medium uppercase tracking-wide text-[#6B6B68]">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-[#EBEBEA] last:border-0">
                <td className="px-4 py-3">{o.clientName}</td>
                <td className="px-4 py-3 font-medium">{o.orderRef}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPrice(o.totalAmount, "NGN")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPrice(o.amountPaid, "NGN")}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-[#C45E0A]">
                  {formatPrice(o.balance, "NGN")}
                </td>
                <td className="px-4 py-3 text-xs text-[#6B6B68]">
                  {o.deliveryDate
                    ? o.deliveryDate.toLocaleDateString("en-GB", { dateStyle: "medium" })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
