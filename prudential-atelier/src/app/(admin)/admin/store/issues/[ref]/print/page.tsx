import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatQty, issueOutstanding } from "@/lib/store/ledger";
import { PrintSlipButton } from "@/components/admin/store/PrintSlipButton";

export default async function StoreIssuePrintPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const rows = await prisma.storeMovement.findMany({
    where: { ref, reason: "ISSUE" },
    orderBy: { createdAt: "asc" },
    include: {
      item: { select: { name: true, unit: true } },
      takenBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      actor: { select: { name: true, email: true } },
      bespokeOrder: { select: { orderRef: true, clientName: true } },
      order: { select: { orderNumber: true } },
      returns: { select: { delta: true } },
    },
  });
  if (rows.length === 0) notFound();

  const first = rows[0];
  const client =
    first.bespokeOrder?.clientName ??
    (first.order?.orderNumber ? `Order ${first.order.orderNumber}` : "—");
  const orderRef = first.bespokeOrder?.orderRef ?? first.order?.orderNumber ?? "—";
  const taken = first.takenBy?.name || first.takenBy?.email || "—";
  const approved = first.approvedBy?.name || first.approvedBy?.email || "—";
  const when = first.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-ink print:p-0">
      <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-text-light">Prudential Atelier</p>
      <h1 className="font-display text-2xl">Material issue slip</h1>
      <p className="mt-1 font-sans text-sm text-text-mid">{ref}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 font-sans text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Client</dt>
          <dd>{client}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Order</dt>
          <dd>{orderRef}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Taken by</dt>
          <dd>{taken}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Supervisor</dt>
          <dd>{approved}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Date</dt>
          <dd>{when}</dd>
        </div>
      </dl>

      <table className="mt-8 w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wide text-text-light">
            <th className="py-2">Material</th>
            <th className="py-2 text-right">Issued</th>
            <th className="py-2 text-right">Returned</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const issued = -Number(row.delta);
            const outstanding = issueOutstanding(row.delta, row.returns.map((r) => r.delta));
            const returned = issued - outstanding;
            return (
              <tr key={row.id} className="border-b border-sand">
                <td className="py-2">{row.item.name}</td>
                <td className="py-2 text-right tabular-nums">{formatQty(issued, row.item.unit)}</td>
                <td className="py-2 text-right tabular-nums">{formatQty(returned, row.item.unit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-16 grid grid-cols-2 gap-12 font-sans text-sm">
        <div>
          <p className="border-t border-ink pt-2">Taken by — signature</p>
        </div>
        <div>
          <p className="border-t border-ink pt-2">Supervisor — signature</p>
        </div>
      </div>

      <p className="mt-10 font-sans text-xs text-text-light print:hidden">
        <PrintSlipButton />
      </p>
    </div>
  );
}
