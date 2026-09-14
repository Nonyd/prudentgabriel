import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import { ConsultationBookingFlow } from "@/components/consultation/ConsultationBookingFlow";
import { getConsultationPageReviews } from "@/lib/consultation-reviews";
import { getPageFieldKeys } from "@/lib/cms-config";
import { getCMSContent } from "@/lib/cms";
import { getSetting } from "@/lib/settings";
import { ATELIER_BOOKINGS_SETTING_KEY } from "@/lib/atelier-bookings";
import { cmsRouteMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("consultation", "/consultation");
}

export default async function ConsultationPage() {
  const [rows, cms, consultationReviews, bookingsSetting] = await Promise.all([
    prisma.consultant.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        offerings: { where: { isActive: true } },
        availability: { where: { isActive: true } },
      },
    }),
    getCMSContent(getPageFieldKeys("consultation")),
    getConsultationPageReviews(),
    getSetting(ATELIER_BOOKINGS_SETTING_KEY),
  ]);
  const consultants = rows as ConsultantWithOfferings[];

  return (
    <ConsultationBookingFlow
      consultants={consultants}
      cms={cms}
      consultationReviews={consultationReviews}
      bookingsEnabled={bookingsSetting === "true"}
    />
  );
}
