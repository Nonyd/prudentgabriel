import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { AdminOrderToolbar } from "@/components/admin/AdminOrderToolbar";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { include: { images: true } }, variant: true } },
      user: true,
      shippingZone: true,
      coupon: true,
    },
  });
  if (!order) notFound();

  const snap = order.addressSnapshot as Record<string, string> | null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/admin/orders" className="text-sm text-[#A8A8A4] hover:text-gold">
        ← Orders
      </Link>
      <div>
        <h1 className="font-display text-3xl text-wine">{order.orderNumber}</h1>
        <p className="mt-1 text-sm text-[#A8A8A4]">
          {order.paymentStatus} · {order.status} · {order.paymentGateway ?? "—"}
        </p>
      </div>

      <AdminOrderToolbar
        order={{
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          adminNotes: order.adminNotes,
          totalNGN: order.total,
          paymentGateway: order.paymentGateway,
        }}
      />

      <div className="rounded-sm border border-[#EBEBEA] bg-white p-6">
        <OrderTimeline status={order.status} />
      </div>

      <div className="overflow-x-auto rounded-sm border border-[#EBEBEA] bg-white p-6">
        <table className="w-full text-left text-sm">
          <thead className="text-[#A8A8A4]">
            <tr>
              <th className="pb-2">Item</th>
              <th className="pb-2">Variant</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2 text-right">Line</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => {
              const img = it.product.images.find((i) => i.isPrimary) ?? it.product.images[0];
              return (
                <tr key={it.id} className="border-t border-[#EBEBEA]">
                  <td className="flex items-center gap-3 py-3">
                    {img?.url ? (
                      <Image src={img.url} alt="" width={48} height={60} className="rounded-sm object-cover" />
                    ) : null}
                    <span className="text-charcoal">{it.product.name}</span>
                  </td>
                  <td className="py-3 text-xs text-[#A8A8A4]">{it.variant?.id ?? "—"}</td>
                  <td className="py-3">{it.quantity}</td>
                  <td className="py-3 text-right">₦{Math.round(it.lineTotal).toLocaleString("en-NG")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-sm border border-[#EBEBEA] bg-white p-6 text-sm text-charcoal">
          <h2 className="font-display text-lg text-gold">Pricing</h2>
          <p className="mt-2">Subtotal: ₦{Math.round(order.subtotal).toLocaleString("en-NG")}</p>
          <p>Shipping: ₦{Math.round(order.shippingAmount).toLocaleString("en-NG")}</p>
          <p>Discount: ₦{Math.round(order.discount).toLocaleString("en-NG")}</p>
          <p>Points: ₦{Math.round(order.pointsDiscountNGN).toLocaleString("en-NG")}</p>
          <p className="mt-2 font-display text-xl text-gold">₦{Math.round(order.total).toLocaleString("en-NG")}</p>
        </div>
        <div className="rounded-sm border border-[#EBEBEA] bg-white p-6 text-sm text-charcoal">
          <h2 className="font-display text-lg text-gold">Customer</h2>
          {order.user ? (
            <>
              <p className="mt-2">{order.user.name}</p>
              <p>{order.user.email}</p>
              <p>{order.user.phone}</p>
              <Link href={`/admin/customers/${order.user.id}`} className="mt-2 inline-block text-gold hover:underline">
                View customer
              </Link>
            </>
          ) : (
            <p className="mt-2">Guest · {order.guestEmail}</p>
          )}
        </div>
      </div>

      {snap && (
        <div className="rounded-sm border border-[#EBEBEA] bg-white p-6 text-sm text-charcoal">
          <h2 className="font-display text-lg text-gold">Address</h2>
          <pre className="mt-2 whitespace-pre-wrap font-body text-xs text-[#A8A8A4]">{JSON.stringify(snap, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
