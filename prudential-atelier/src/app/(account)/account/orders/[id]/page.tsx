import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderTimeline } from "@/components/account/OrderTimeline";

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

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account/orders" className="text-sm text-wine hover:underline">
        ← My orders
      </Link>
      <h1 className="mt-4 font-display text-3xl text-wine">{order.orderNumber}</h1>
      <p className="text-sm text-charcoal-light">{new Date(order.createdAt).toLocaleString()}</p>

      <div className="mt-8 rounded-sm border border-border bg-cream p-6">
        <OrderTimeline status={order.status} />
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
                  <td>{it.size}</td>
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
        {order.pointsDiscountNGN > 0 && <p>Points −₦{Math.round(order.pointsDiscountNGN).toLocaleString()}</p>}
        <p className="mt-2 font-display text-xl text-wine">₦{Math.round(order.total).toLocaleString()}</p>
      </div>

      {order.shippingZone && (
        <p className="mt-4 text-sm text-charcoal-mid">
          Shipping: {order.shippingZone.name} · {order.shippingZone.estimatedDays}
        </p>
      )}

      <a
        className="mt-8 inline-block text-sm text-wine hover:underline"
        href={`mailto:hello@prudentgabriel.com?subject=Order%20${encodeURIComponent(order.orderNumber)}`}
      >
        Need help with this order?
      </a>
    </div>
  );
}
