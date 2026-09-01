import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { formatSnapshotForDisplay, parseSnapshot } from "@/lib/custom-size";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const order = await prisma.order.findFirst({
    where: { id, userId: session!.user!.id! },
    include: {
      items: { include: { product: { include: { images: true } }, variant: true } },
      shippingZone: true,
    },
  });

  if (!order) notFound();

  const earned = await prisma.pointsTransaction.findFirst({
    where: { orderId: order.id, type: "EARNED_PURCHASE" },
    select: { amount: true },
  });

  const canDeleteOrder =
    order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account/orders" className="text-sm text-wine hover:underline">
        ← My orders
      </Link>
      <h1 className="mt-4 font-display text-3xl text-wine">{order.orderNumber}</h1>
      <p className="text-sm text-charcoal-light">{new Date(order.createdAt).toLocaleString()}</p>

      <div className="mt-8 rounded-sm border border-border bg-cream p-6">
        <OrderTimeline
          status={order.status}
          pickup={order.shippingMethodKind === "PICKUP"}
          madeToOrder={order.fulfilmentKind === "MADE_TO_ORDER" || order.fulfilmentKind === "MIXED"}
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-charcoal-mid">
              <th className="py-2">Item</th>
              <th>Size</th>
              <th>Qty</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => {
              const img = it.product.images.find((i) => i.isPrimary) ?? it.product.images[0];
              return (
                <tr key={it.id} className="border-b border-border/60">
                  <td className="flex items-center gap-3 py-3">
                    {img?.url && (
                      <Image src={img.url} alt="" width={48} height={60} className="rounded-sm object-cover" />
                    )}
                    <span>{it.product.name}</span>
                  </td>
                  <td>
                    {it.sizeMode === "CUSTOM" ? (
                      <span>
                        Made to your measurements
                        {parseSnapshot(it.measurements).length ? (
                          <>
                            <br />
                            <span className="text-xs text-charcoal-mid">
                              {formatSnapshotForDisplay(parseSnapshot(it.measurements))}
                            </span>
                          </>
                        ) : null}
                      </span>
                    ) : (
                      it.size
                    )}
                  </td>
                  <td>{it.quantity}</td>
                  <td className="text-right">₦{Math.round(it.lineTotal).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-sm border border-border bg-ivory-dark/30 p-6 text-right text-sm">
        <p>Subtotal ₦{Math.round(order.subtotal).toLocaleString()}</p>
        <p>Shipping ₦{Math.round(order.shippingAmount).toLocaleString()}</p>
        {order.discount > 0 && <p>Coupon −₦{Math.round(order.discount).toLocaleString()}</p>}
        {order.pointsDiscountNGN > 0 && (
          <p>
            Points −₦{Math.round(order.pointsDiscountNGN).toLocaleString()}
            {order.pointsUsed > 0 ? ` (${order.pointsUsed.toLocaleString()} pts` : ""}
            {order.pointsRateLocked != null ? ` at ₦${order.pointsRateLocked}/pt)` : order.pointsUsed > 0 ? ")" : ""}
          </p>
        )}
        <p className="mt-2 font-display text-xl text-wine">₦{Math.round(order.total).toLocaleString()}</p>
        {earned && earned.amount > 0 ? (
          <p className="mt-2 text-left text-sm text-choc">
            This purchase earned {earned.amount.toLocaleString()} Prudent Points.
          </p>
        ) : order.pointsUsed > 0 && order.paymentStatus === PaymentStatus.PAID ? (
          <p className="mt-2 text-left text-sm text-choc">
            This purchase earned no Prudent Points because it was paid with points.
          </p>
        ) : null}
        {order.paymentRef ? <p className="mt-2 text-left text-xs text-charcoal-mid">Payment reference: {order.paymentRef}</p> : null}
        {order.collectionCode ? (
          <p className="mt-1 text-left text-xs text-charcoal-mid">Collection code: {order.collectionCode}</p>
        ) : null}
        {order.currency === "USD" && order.fxRateLocked != null ? (
          <p className="mt-1 text-left text-xs text-charcoal-mid">
            ${((order.total * order.fxRateLocked)).toFixed(2)} at the rate locked on this order (₦1 = $
            {order.fxRateLocked.toFixed(6)})
          </p>
        ) : null}
      </div>

      {order.shippingZone && (
        <p className="mt-4 text-sm text-charcoal-mid">
          Shipping: {order.shippingZone.name} · {order.shippingZone.estimatedDays}
        </p>
      )}

      <CustomerOrderDeleteButton orderId={order.id} orderNumber={order.orderNumber} canDelete={canDeleteOrder} />

      <a
        className="mt-8 inline-block text-sm text-wine hover:underline"
        href={`mailto:hello@prudentgabriel.com?subject=Order%20${encodeURIComponent(order.orderNumber)}`}
      >
        Need help with this order?
      </a>
    </div>
  );
}
