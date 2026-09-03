import Link from "next/link";
import { notFound } from "next/navigation";
import type { StockMovementReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const REASON_LABEL: Record<StockMovementReason, string> = {
  SALE: "Sale",
  CANCEL_RETURN: "Cancel return",
  REFUND_RETURN: "Refund return",
  COUNT_CORRECTION: "Count correction",
  RECEIPT: "Receipt",
  WRITE_OFF: "Write-off",
  OPENING: "Opening",
};

function formatWhen(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProductStockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      variants: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          size: true,
          sku: true,
          stock: true,
          stockMovements: {
            orderBy: { createdAt: "desc" },
            include: {
              actor: { select: { name: true, email: true } },
              order: { select: { id: true, orderNumber: true } },
            },
          },
        },
      },
    },
  });
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href={`/admin/products/${product.id}/edit`} className="font-sans text-sm text-text-mid hover:text-nut">
        ← {product.name}
      </Link>
      <div>
        <h1 className="font-serif text-3xl text-choc">Stock history</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Every change to a size, in order. The number on the product is the sum of these rows.
        </p>
      </div>

      {product.variants.length === 0 ? (
        <p className="font-sans text-sm text-text-mid">This piece has no sizes yet.</p>
      ) : (
        product.variants.map((v) => (
          <section key={v.id} className="card-surface overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 border-b border-sand px-6 py-4">
              <div>
                <h2 className="font-sans text-[15px] font-medium text-choc">
                  {v.size}
                  {v.sku ? <span className="ml-2 font-mono text-[11px] text-text-mid">{v.sku}</span> : null}
                </h2>
              </div>
              <p className="font-sans text-sm text-choc">
                On hand <span className="font-medium">{v.stock}</span>
              </p>
            </div>
            {v.stockMovements.length === 0 ? (
              <p className="px-6 py-5 font-sans text-sm text-text-mid">No movements. Stock is zero and has never been counted.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="font-sans text-[10px] uppercase tracking-wide text-text-light">
                    <th className="px-6 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Change</th>
                    <th className="px-3 py-2 font-medium">Why</th>
                    <th className="px-3 py-2 font-medium">Who</th>
                    <th className="px-6 py-2 font-medium">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {v.stockMovements.map((m) => (
                    <tr key={m.id} className="border-t border-sand/80 font-sans text-[13px] text-choc">
                      <td className="whitespace-nowrap px-6 py-3 text-text-mid">{formatWhen(m.createdAt)}</td>
                      <td className={`px-3 py-3 font-medium ${m.delta < 0 ? "text-wine" : "text-choc"}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="px-3 py-3">
                        {REASON_LABEL[m.reason]}
                        {m.note ? (
                          <span className="mt-0.5 block text-[11px] text-text-mid">{m.note}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-text-mid">
                        {m.actor?.name ?? m.actor?.email ?? (m.actorId ? m.actorId : "System")}
                      </td>
                      <td className="px-6 py-3">
                        {m.order ? (
                          <Link href={`/admin/orders/${m.order.id}`} className="text-nut hover:underline">
                            {m.order.orderNumber}
                          </Link>
                        ) : (
                          <span className="text-text-light">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))
      )}
    </div>
  );
}
