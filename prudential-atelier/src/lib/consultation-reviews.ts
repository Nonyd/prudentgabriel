import { prisma } from "@/lib/prisma";
import { getDeliveryModeLabel, getSessionTypeLabel } from "@/lib/consultation";

export type ConsultationReviewSlide = {
  id: string;
  body: string;
  rating: number;
  userName: string;
  consultationLabel: string;
};

function formatAttributionName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "Client").trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "Client";
  const last = parts[parts.length - 1]!;
  const initial = last.charAt(0).toUpperCase();
  return `${parts[0]} ${initial}.`;
}

export async function getConsultationPageReviews(limit = 8): Promise<ConsultationReviewSlide[]> {
  const rows = await prisma.review.findMany({
    where: {
      isApproved: true,
      consultationId: { not: null },
      showOnConsultationPage: true,
    },
    include: {
      user: { select: { name: true } },
      consultation: {
        select: {
          consultant: { select: { name: true } },
          offering: { select: { sessionType: true, deliveryMode: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r) => {
    const session = r.consultation?.offering
      ? getSessionTypeLabel(r.consultation.offering.sessionType)
      : "Consultation";
    const mode = r.consultation?.offering
      ? getDeliveryModeLabel(r.consultation.offering.deliveryMode)
      : "";
    const consultant = r.consultation?.consultant?.name ?? "Mrs. Prudent";
    const consultationLabel = [mode, `with ${consultant}`].filter(Boolean).join(" · ");

    return {
      id: r.id,
      body: r.body ?? "",
      rating: r.rating,
      userName: formatAttributionName(r.user.name),
      consultationLabel: consultationLabel || session,
    };
  });
}
