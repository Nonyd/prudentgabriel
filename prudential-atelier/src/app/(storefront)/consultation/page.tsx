import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import { ConsultationBookingFlow } from "@/components/consultation/ConsultationBookingFlow";
import { SectionLabel } from "@/components/ui/SectionLabel";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const base = getPublicAppUrl();
  return {
    title: "Book a Consultation — Prudent Gabriel",
    description: "Choose your consultant and book a private session with Prudent Gabriel.",
    openGraph: {
      title: "Book a Consultation — Prudent Gabriel",
      url: `${base}/consultation`,
    },
  };
}

export default async function ConsultationPage() {
  const rows = await prisma.consultant.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      offerings: { where: { isActive: true } },
      availability: { where: { isActive: true } },
    },
  });
  const consultants = rows as ConsultantWithOfferings[];

  return (
    <div className="bg-white">
      <section className="relative flex h-[300px] flex-col justify-center overflow-hidden md:h-[500px]">
        <Image
          src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1600&q=90"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-charcoal/70" />
        <div className="relative z-10 mx-auto max-w-site px-6 py-12 text-center md:px-10">
          <SectionLabel light className="text-white/50">
            Book a Consultation
          </SectionLabel>
          <h1 className="mt-3 font-display text-[36px] font-normal italic leading-[0.95] text-white md:text-[64px]">
            Your Vision,
            <br />
            Our Craft.
          </h1>
          <p className="mx-auto mt-4 max-w-lg font-body text-[14px] font-light text-white/60 md:text-[15px]">
            Choose your consultant. Select your session. Begin the journey.
          </p>
        </div>
      </section>
      <ConsultationBookingFlow consultants={consultants} />
    </div>
  );
}
