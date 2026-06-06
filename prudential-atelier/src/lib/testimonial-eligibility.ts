import { prisma } from "@/lib/prisma";

export async function canSubmitTestimonial(userId: string): Promise<{
  eligible: boolean;
  reason?: string;
  completedPurchases: number;
  hasExistingTestimonial: boolean;
  pendingTestimonial: boolean;
}> {
  const [deliveredOrders, completedConsultations, deliveredBespoke, existingTestimonial] =
    await Promise.all([
      prisma.order.count({
        where: { userId, status: "DELIVERED", isBespoke: false },
      }),
      prisma.consultationBooking.count({
        where: { userId, status: "COMPLETED" },
      }),
      prisma.bespokeOrder.count({
        where: {
          clientProfile: { userId },
          currentStage: "DELIVERY",
          status: "DELIVERED",
        },
      }),
      prisma.testimonial.findFirst({
        where: { userId },
        select: { id: true, isApproved: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const total = deliveredOrders + completedConsultations + deliveredBespoke;

  return {
    eligible: total > 0,
    completedPurchases: total,
    reason: total === 0 ? "Complete a purchase or consultation first" : undefined,
    hasExistingTestimonial: Boolean(existingTestimonial),
    pendingTestimonial: Boolean(existingTestimonial && !existingTestimonial.isApproved),
  };
}
