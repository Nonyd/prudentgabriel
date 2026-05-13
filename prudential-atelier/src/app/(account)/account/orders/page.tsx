import { auth } from "@/auth";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccountOrdersList } from "@/components/account/AccountOrdersList";

export default async function OrdersPage() {
  const session = await auth();
  const orders = await prisma.order.findMany({
    where: { userId: session!.user!.id! },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        take: 3,
        include: {
          product: { select: { name: true, images: { where: { isPrimary: true }, take: 1 } } },
        },
      },
    },
  });

  const rows = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    total: o.total,
    status: o.status,
    paymentStatus: o.paymentStatus,
    previewImages: o.items.map((it) => it.product.images[0]?.url).filter((u): u is string => Boolean(u)),
    canDelete: o.paymentStatus === PaymentStatus.PENDING || o.paymentStatus === PaymentStatus.FAILED,
  }));

  return (
    <div>
      <h1 className="font-display text-3xl text-wine">My orders</h1>
      <p className="mt-1 text-sm text-charcoal-mid">{orders.length} orders</p>
      <AccountOrdersList orders={rows} />
    </div>
  );
}
