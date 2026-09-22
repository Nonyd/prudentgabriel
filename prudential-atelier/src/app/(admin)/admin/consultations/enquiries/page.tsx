import Link from "next/link";
import { ConsultationEnquiryQueue } from "@/components/admin/ConsultationEnquiryQueue";

export const dynamic = "force-dynamic";

/** BA2: the enquiry queue. Pending first, oldest first; approve or decline with a reason. */
export default async function AdminConsultationEnquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ open?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  return (
    <div>
      <h1 className="admin-heading-pill glass-1 glass-pill font-display text-2xl text-ink">Consultation enquiries</h1>
      <p className="mt-1 font-body text-[13px] text-[#6B6B68]">
        Every consultation starts here. Approving emails the client a booking link;{" "}
        <Link href="/admin/consultations" className="underline">
          bookings
        </Link>{" "}
        appear once she has proposed dates and paid.
      </p>
      <ConsultationEnquiryQueue openId={sp.open ?? null} />
    </div>
  );
}
