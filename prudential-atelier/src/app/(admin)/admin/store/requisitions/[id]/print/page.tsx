import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STATUS_LABEL } from "@/lib/requisition/states";
import { PrintSlipButton } from "@/components/admin/store/PrintSlipButton";

export default async function StoreRequisitionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await prisma.requisition.findUnique({
    where: { id },
    include: {
      lines: { include: { item: { select: { name: true, unit: true } } } },
      raisedBy: { select: { name: true, email: true } },
      bespokeOrder: { select: { orderRef: true, clientName: true } },
      order: { select: { orderNumber: true } },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });
  if (!r) notFound();

  const client =
    r.bespokeOrder?.clientName ?? (r.order?.orderNumber ? `Order ${r.order.orderNumber}` : "—");
  const orderRef = r.bespokeOrder?.orderRef ?? r.order?.orderNumber ?? "—";
  const stockCheck = [...r.events].reverse().find((e) => e.toStatus === "STOCK_CHECKED");
  const buyLines = r.lines.filter((l) => !l.coveredByStock);
  const total = buyLines.reduce((s, l) => s + Number(l.estimatedCostNGN), 0);

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-ink print:p-0">
      <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-text-light">Prudential Atelier</p>
      <h1 className="font-display text-2xl">Material requisition</h1>
      <p className="mt-1 font-sans text-sm text-text-mid">
        {r.ref} · {STATUS_LABEL[r.status]}
      </p>

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
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Raised by</dt>
          <dd>{r.raisedBy.name || r.raisedBy.email}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Stock check</dt>
          <dd>{stockCheck ? stockCheck.actor.name || stockCheck.actor.email : "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-text-light">Total</dt>
          <dd>₦{total.toLocaleString("en-NG")}</dd>
        </div>
      </dl>

      {r.sameActorShortCircuit ? (
        <p className="mt-4 border border-sand px-3 py-2 font-sans text-xs">
          Raised and approved by the same person on consecutive steps.
        </p>
      ) : null}

      <table className="mt-8 w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wide text-text-light">
            <th className="py-2">Material</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Confirmed</th>
            <th className="py-2 text-right">Est. ₦</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((line) => (
            <tr key={line.id} className="border-b border-sand">
              <td className="py-2">
                {line.item?.name ?? line.freeText}
                {line.coveredByStock ? " (from shelf)" : ""}
              </td>
              <td className="py-2 text-right">
                {Number(line.quantity)} {line.unit}
              </td>
              <td className="py-2 text-right">
                {line.confirmedQuantity != null ? Number(line.confirmedQuantity) : "—"}
              </td>
              <td className="py-2 text-right">{Number(line.estimatedCostNGN).toLocaleString("en-NG")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 print:hidden">
        <PrintSlipButton />
      </div>
    </div>
  );
}
