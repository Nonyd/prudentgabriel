import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { AdminOrderToolbar } from "@/components/admin/AdminOrderToolbar";
import { ShippingQuotePanel } from "@/components/admin/ShippingQuotePanel";
import { orderWhatsAppUrl, phoneFromOrder } from "@/lib/shipping/whatsapp";
import { OrderMeasurementsBlock } from "@/components/admin/OrderMeasurementsBlock";
import { PrintGuideButton } from "@/components/admin/PrintGuideButton";
import { AdminBankTransferProof } from "@/components/admin/AdminBankTransferProof";

function formatAddress(snap: Record<string, string>) {
  const lines = [
    [snap.firstName, snap.lastName].filter(Boolean).join(" "),
    snap.line1,
    snap.line2,
    [snap.city, snap.state].filter(Boolean).join(", "),
    snap.country,
    snap.postalCode,
    snap.phone,
  ].filter((v) => v && String(v).trim());
  return lines.join("\n");
}

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

  const earned = await prisma.pointsTransaction.findFirst({
    where: { orderId: order.id, type: "EARNED_PURCHASE" },
    select: { amount: true },
  });

  const snap = order.addressSnapshot as Record<string, string> | null;
  const phone = phoneFromOrder(order);
  const wa = orderWhatsAppUrl(phone, order.orderNumber);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/admin/orders" className="text-sm text-[#A8A8A4] hover:text-gold">
        ← Orders
      </Link>
      <div>
        <h1 className="font-display text-3xl text-wine">{order.orderNumber}</h1>
        <p className="mt-1 text-sm text-[#A8A8A4]">
          {order.paymentStatus} · {order.status} · {order.paymentGateway ?? "—"}
          {order.fulfilmentKind !== "STOCK" ? " · Made to order" : ""}
        </p>
        {order.guestCustom ? (
          <p className="mt-3 border border-[#E8D5B0] bg-[#FFF8E7] px-3 py-2 text-sm text-[#92660A]">
            Guest custom order — call before cutting. No account, no measurement history.
          </p>
        ) : null}
        {order.refundRecordedAt ? (
          <p className="mt-3 border border-olive/30 bg-olive/5 px-3 py-2 text-sm text-olive">
            Refund recorded {order.refundRecordedAt.toLocaleString("en-GB")}
            {order.refundRecordedByName ? ` by ${order.refundRecordedByName}` : ""}
            {order.refundRecordedAmountNGN != null
              ? ` — ₦${Math.round(order.refundRecordedAmountNGN).toLocaleString("en-NG")}`
              : ""}
            . PSP refund is still issued in the gateway dashboard.
          </p>
        ) : null}
        <div className="mt-3 print:hidden">
          <PrintGuideButton />
        </div>
      </div>

      <AdminBankTransferProof
        orderId={order.id}
        orderNumber={order.orderNumber}
        paymentStatus={order.paymentStatus}
        paymentGateway={order.paymentGateway}
        receiptUrl={order.paymentReceiptUrl}
        amountNGN={order.total}
        currency={String(order.currency)}
      />

      <AdminOrderToolbar
        order={{
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          adminNotes: order.adminNotes,
          totalNGN: order.total,
          paymentGateway: order.paymentGateway,
          shippingMethodKind: order.shippingMethodKind,
          fulfilmentKind: order.fulfilmentKind,
          carrier: order.carrier,
          balance: order.balance,
          collectionCode: order.collectionCode,
        }}
      />

      <div className="rounded-sm border border-sand bg-canvas p-6">
        <OrderTimeline
          status={order.status}
          pickup={order.shippingMethodKind === "PICKUP"}
          madeToOrder={order.fulfilmentKind === "MADE_TO_ORDER" || order.fulfilmentKind === "MIXED"}
        />
      </div>

      {order.shippingQuoteStatus === ShippingQuoteStatus.QUOTE_PENDING ||
      order.shippingQuoteStatus === ShippingQuoteStatus.QUOTED ? (
        <ShippingQuotePanel
          orderId={order.id}
          currentShipping={order.shippingAmount}
          currentCarrier={order.carrier}
          currentNote={order.shippingQuoteNote}
          orderStatus={order.status}
          preferredContact={order.preferredContactMethod}
          whatsappUrl={wa}
        />
      ) : null}

      <OrderMeasurementsBlock items={order.items} />

      <div className="overflow-x-auto rounded-sm border border-sand bg-canvas p-6">
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
                <tr key={it.id} className="border-t border-sand">
                  <td className="flex items-center gap-3 py-3">
                    {img?.url ? (
                      <Image src={img.url} alt="" width={48} height={60} className="rounded-sm object-cover" />
                    ) : null}
                    <span className="text-charcoal">{it.product.name}</span>
                  </td>
                  <td className="py-3 text-xs text-[#A8A8A4]">
                    {it.sizeMode === "CUSTOM" ? "Custom" : it.size ?? it.variant?.size ?? "—"}
                  </td>
                  <td className="py-3">{it.quantity}</td>
                  <td className="py-3 text-right">₦{Math.round(it.lineTotal).toLocaleString("en-NG")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-sm border border-sand bg-canvas p-6 text-sm text-charcoal">
          <h2 className="font-display text-lg text-gold">Pricing</h2>
          <p className="mt-2">Subtotal: ₦{Math.round(order.subtotal).toLocaleString("en-NG")}</p>
          <p>Shipping: ₦{Math.round(order.shippingAmount).toLocaleString("en-NG")}</p>
          <p>Discount: ₦{Math.round(order.discount).toLocaleString("en-NG")}</p>
          <p>Points: ₦{Math.round(order.pointsDiscountNGN).toLocaleString("en-NG")}
            {order.pointsUsed > 0 ? ` (${order.pointsUsed.toLocaleString()} pts` : ""}
            {order.pointsRateLocked != null ? ` at ₦${order.pointsRateLocked}/pt)` : order.pointsUsed > 0 ? ")" : ""}
          </p>
          <p className="mt-2 font-display text-xl text-gold">₦{Math.round(order.total).toLocaleString("en-NG")}</p>
          {earned && earned.amount > 0 ? (
            <p className="mt-2 text-sm text-choc">This purchase earned {earned.amount.toLocaleString()} Prudent Points.</p>
          ) : order.pointsUsed > 0 ? (
            <p className="mt-2 text-sm text-choc">Paid with Prudent Points — no points earned on this order.</p>
          ) : null}
          {order.paymentRef ? <p className="mt-3 text-xs text-[#6B6B68]">Payment ref: {order.paymentRef}</p> : null}
          {order.fxRateLocked != null ? (
            <p className="mt-1 text-xs text-[#6B6B68]">
              FX locked: ₦1 = ${order.fxRateLocked.toFixed(6)}
              {order.fxRateStale ? " (stale — feed unavailable at checkout)" : ""}
              {order.fxRateSource ? ` · ${order.fxRateSource}` : ""}
            </p>
          ) : null}
          {order.collectionCode ? <p className="mt-1 text-xs text-[#6B6B68]">Collection code: {order.collectionCode}</p> : null}
          {order.balance > 0.01 ? (
            <p className="mt-2 text-xs text-[#92660A]">Balance owing ₦{Math.round(order.balance).toLocaleString("en-NG")}</p>
          ) : null}
        </div>
        <div className="rounded-sm border border-sand bg-canvas p-6 text-sm text-charcoal">
          <h2 className="font-display text-lg text-gold">Customer</h2>
          {order.user ? (
            <>
              <p className="mt-2">{order.user.name}</p>
              <p>{order.user.email}</p>
              <p>{order.user.phone}</p>
              {order.preferredContactMethod ? (
                <p className="mt-1 text-xs text-[#6B6B68]">Reach via {order.preferredContactMethod.toLowerCase()}</p>
              ) : null}
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="mt-2 inline-block text-gold hover:underline">
                  WhatsApp about this order
                </a>
              ) : null}
              <Link href={`/admin/customers/${order.user.id}`} className="mt-2 block text-gold hover:underline">
                View customer
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2">Guest · {order.guestEmail}</p>
              {order.guestPhone ? <p>{order.guestPhone}</p> : null}
              {order.preferredContactMethod ? (
                <p className="mt-1 text-xs text-[#6B6B68]">Reach via {order.preferredContactMethod.toLowerCase()}</p>
              ) : null}
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="mt-2 inline-block text-gold hover:underline">
                  WhatsApp about this order
                </a>
              ) : null}
            </>
          )}
        </div>
      </div>

      {snap && (
        <div className="rounded-sm border border-sand bg-canvas p-6 text-sm text-charcoal">
          <h2 className="font-display text-lg text-gold">Address</h2>
          <pre className="mt-2 whitespace-pre-wrap font-body text-base leading-7 text-charcoal">{formatAddress(snap)}</pre>
        </div>
      )}
    </div>
  );
}
