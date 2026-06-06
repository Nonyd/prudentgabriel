import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDeliveryModeLabel, getSessionTypeLabel } from "@/lib/consultation";
import { ReviewSubmitClient } from "@/components/account/ReviewSubmitClient";

type Props = { searchParams: Promise<{ product?: string; order?: string; consultation?: string }> };

export default async function NewReviewPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const { product: productId, order: orderId, consultation: consultationId } = params;

  if (consultationId) {
    const booking = await prisma.consultationBooking.findFirst({
      where: { id: consultationId, userId, status: "COMPLETED" },
      include: {
        consultant: { select: { name: true } },
        offering: { select: { sessionType: true, deliveryMode: true } },
      },
    });
    if (!booking) notFound();

    const existing = await prisma.review.findFirst({
      where: { userId, consultationId },
      select: { id: true },
    });
    if (existing) redirect("/account");

    const sessionLabel = getSessionTypeLabel(booking.offering.sessionType);
    const modeLabel = getDeliveryModeLabel(booking.offering.deliveryMode);
    const label = `${modeLabel} with ${booking.consultant.name ?? "Mrs. Prudent"}`;
    const dateLabel = booking.confirmedDate
      ? booking.confirmedDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : booking.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    return (
      <div className="px-4 py-8 md:px-8">
        <ReviewSubmitClient
          context={{
            kind: "consultation",
            consultationId: booking.id,
            label: `${sessionLabel} · ${label}`,
            dateLabel,
          }}
        />
      </div>
    );
  }

  if (productId && orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, status: "DELIVERED" },
      include: {
        items: {
          where: { productId },
          take: 1,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    });
    const item = order?.items[0];
    if (!item?.product) notFound();

    const existing = await prisma.review.findFirst({
      where: { userId, productId },
      select: { id: true },
    });
    if (existing) redirect("/account");

    return (
      <div className="px-4 py-8 md:px-8">
        <ReviewSubmitClient
          context={{
            kind: "product",
            productId: item.product.id,
            orderId,
            productName: item.product.name,
            productImage: item.product.images[0]?.url ?? null,
          }}
        />
      </div>
    );
  }

  notFound();
}
