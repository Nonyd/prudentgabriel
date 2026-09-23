import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import { getPageFieldKeys } from "@/lib/cms-config";
import { getCMSContent } from "@/lib/cms";
import { tokenRouteMetadata } from "@/lib/seo";
import { tokenPageRateLimited } from "@/lib/page-rate-limit";
import { findBookableEnquiry } from "@/lib/consultation-enquiry";
import { ConsultationInvitationFlow } from "@/components/consultation/ConsultationInvitationFlow";
import { quoteConsultationFees } from "@/lib/consultation-fees";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return tokenRouteMetadata("Book your consultation");
}

/**
 * BA2: the booking step. Opens only for an approved, unexpired, unbooked
 * enquiry; anything else (unknown, pending, declined, expired, used) is a real 404.
 */
export default async function ConsultationInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  if (await tokenPageRateLimited("consultation-book-page")) notFound();
  const { token } = await params;
  const enquiry = await findBookableEnquiry(token);
  if (!enquiry) notFound();

  const [rows, cms, quote] = await Promise.all([
    prisma.consultant.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        offerings: { where: { isActive: true } },
        availability: { where: { isActive: true } },
      },
    }),
    getCMSContent(getPageFieldKeys("consultation")),
    quoteConsultationFees(),
  ]);

  return (
    <ConsultationInvitationFlow
      consultants={rows as ConsultantWithOfferings[]}
      cms={cms}
      fees={quote.fees}
      invitation={{
        token,
        enquiryNumber: enquiry.enquiryNumber,
        clientName: enquiry.clientName,
        clientEmail: enquiry.clientEmail,
        clientPhone: enquiry.clientPhone,
        eventType: enquiry.eventType,
        eventDateLabel: enquiry.eventDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
      }}
    />
  );
}
