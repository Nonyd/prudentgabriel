import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  return (
    <div>
      <h1 className="font-display text-3xl text-wine">My orders</h1>
      <p className="mt-1 text-sm text-charcoal-mid">{orders.length} orders</p>
      <div className="mt-8 space-y-4">
        {orders.length === 0 ? (
          <p className="text-charcoal-mid">
            No orders yet.{" "}
            <Link href="/shop" className="text-wine underline">
              Browse collection
            </Link>
          </p>
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              href={`/account/orders/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-cream p-4 hover:border-wine/30"
            >
              <div>
                <p className="font-label text-xs text-gold">{o.orderNumber}</p>
                <p className="text-sm text-charcoal-light">{new Date(o.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex -space-x-2">
                {o.items.map((it) => {
                  const img = it.product.images[0]?.url;
                  return img ? (
                    <Image
                      key={it.id}
                      src={img}
                      alt=""
                      width={40}
                      height={48}
                      className="relative rounded-sm border-2 border-ivory object-cover"
                    />
                  ) : null;
                })}
              </div>
              <div className="text-right">
                <p className="font-medium">₦{Math.round(o.total).toLocaleString()}</p>
                <span className="text-xs uppercase text-charcoal-mid">{o.status}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
