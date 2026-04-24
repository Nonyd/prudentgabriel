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
    title: "Book a Consultation — Prudential Atelier",
    description: "Choose your consultant and book a private session with Prudential Atelier.",
    openGraph: {
      title: "Book a Consultation — Prudential Atelier",
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
    <div className="bg-ivory">
      <section className="relative flex min-h-[300px] flex-col justify-center overflow-hidden md:min-h-[500px]">
        <Image
          src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-charcoal/75" />
        <div className="relative z-10 mx-auto max-w-site px-6 py-16 text-center lg:px-10">
          <SectionLabel className="text-gold">BOOK A CONSULTATION</SectionLabel>
          <h1 className="mt-4 font-display text-4xl italic leading-tight text-ivory md:text-5xl">
            Your Vision Starts
            <br />
            With a Conversation.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-ivory/70 md:text-base">
            Choose your consultant, select your session, and begin the journey to your most exquisite piece.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 font-label text-[11px] text-ivory/60">
            <span>Secure payment</span>
            <span className="text-gold/50">|</span>
            <span>Expert guidance</span>
            <span className="text-gold/50">|</span>
            <span>Flexible scheduling</span>
          </div>
        </div>
      </section>
      <ConsultationBookingFlow consultants={consultants} />
    </div>
  );
}
