import type { Metadata } from "next";
import { ConsultationEnquiryForm } from "@/components/consultation/ConsultationEnquiryForm";
import { ConsultationReviewsSlider } from "@/components/consultation/ConsultationReviewsSlider";
import { getConsultationPageReviews } from "@/lib/consultation-reviews";
import { getPageFieldKeys } from "@/lib/cms-config";
import { getCMSContent } from "@/lib/cms";
import { cmsGet } from "@/lib/cms-helpers";
import { cmsRouteMetadata } from "@/lib/seo";
import Link from "next/link";
import { ATELIER_CLOSED_COPY, ATELIER_CONTACT_HREF, isAtelierOpenForEnquiries } from "@/lib/atelier-bookings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("consultation", "/consultation");
}

/**
 * BA2: consultations are by invitation. This page is the enquiry (the atelier
 * application); booking and payment happen only through an approved link.
 * atelier_bookings_enabled off = the house is closed to new commissions.
 */
export default async function ConsultationPage() {
  const [cms, consultationReviews, open] = await Promise.all([
    getCMSContent(getPageFieldKeys("consultation")),
    getConsultationPageReviews(),
    isAtelierOpenForEnquiries(),
  ]);

  return (
    <div className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <h1 className="font-serif text-[40px] font-normal leading-tight text-choc md:text-[56px]">
            {cmsGet(cms, "consultation_page_title", "Sit with us")}
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] font-body text-[15px] leading-relaxed text-text-mid">
            {cmsGet(
              cms,
              "consultation_enquiry_subtitle",
              "Every commission begins with a conversation. Tell us about the occasion; the house reads every enquiry and replies with an invitation to book.",
            )}
          </p>
        </header>
        {open ? (
          <ConsultationEnquiryForm cms={cms} />
        ) : (
          <div className="mx-auto max-w-xl glass-2 glass-panel px-6 py-8 text-center" role="status">
            <p className="font-body text-[15px] leading-relaxed text-text-mid">
              {cmsGet(cms, "consultation_closed_copy", ATELIER_CLOSED_COPY)}
            </p>
            <Link
              href={ATELIER_CONTACT_HREF}
              className="mt-5 inline-flex rounded-sm bg-nut px-8 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cream transition-colors hover:bg-choc"
            >
              Write to the house
            </Link>
          </div>
        )}
        <ConsultationReviewsSlider items={consultationReviews} />
      </div>
    </div>
  );
}
