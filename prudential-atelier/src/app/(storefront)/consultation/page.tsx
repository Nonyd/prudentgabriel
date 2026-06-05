import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import { ConsultationBookingFlow } from "@/components/consultation/ConsultationBookingFlow";
import { getPageFieldKeys } from "@/lib/cms-config";
import { getCMSContent } from "@/lib/cms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const base = getPublicAppUrl();
  return {
    title: "Book a Consultation — Prudent Gabriel",
    description: "Choose your consultation type and book a private session with Prudent Gabriel.",
    openGraph: {
      title: "Book a Consultation — Prudent Gabriel",
      url: `${base}/consultation`,
    },
  };
}

export default async function ConsultationPage() {
  const [rows, cms] = await Promise.all([
    prisma.consultant.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        offerings: { where: { isActive: true } },
        availability: { where: { isActive: true } },
      },
    }),
    getCMSContent(getPageFieldKeys("consultation")),
  ]);
  const consultants = rows as ConsultantWithOfferings[];

  return <ConsultationBookingFlow consultants={consultants} cms={cms} />;
}
