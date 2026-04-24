"use client";

import Image from "next/image";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BespokeForm } from "@/components/bespoke/BespokeForm";

export default function BespokePage() {
  return (
    <div>
      <div className="relative h-[420px] overflow-hidden bg-black">
        <Image
          src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute bottom-0 left-0 z-[1] max-w-xl p-8 pb-12 md:p-20 md:pb-20">
          <SectionLabel className="text-olive">The Atelier</SectionLabel>
          <h1 className="mt-3 font-display text-[48px] font-normal italic leading-[0.95] text-white md:text-[72px]">
            Your Vision,
            <br />
            Our Craft.
          </h1>
        </div>
      </div>
      <div className="border-b border-mid-grey bg-off-white px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-site flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="font-body text-sm font-light text-charcoal">
            Looking to discuss your vision before committing? Book a consultation first.
          </p>
          <Link
            href="/consultation"
            className="shrink-0 border-b border-olive pb-0.5 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-olive"
          >
            Book a Consultation →
          </Link>
        </div>
      </div>
      <div className="bg-off-white py-16 md:py-[100px]">
        <div className="mx-auto grid max-w-site gap-10 px-4 md:grid-cols-4 md:gap-6 md:px-8">
          {["Consultation", "Design & Fabric", "Fitting", "Delivery"].map((t, i) => (
            <div key={t} className="text-center md:text-left">
              <p className="font-display text-[56px] font-normal italic leading-none text-olive/20 md:text-[64px]">
                0{i + 1}
              </p>
              <p className="mt-2 font-display text-lg font-medium text-charcoal">{t}</p>
              <p className="mt-2 max-w-[200px] font-body text-[13px] font-light text-dark-grey md:mx-0 md:max-w-none">
                A dedicated step in your journey.
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-2xl bg-white px-4 py-16 md:px-8 md:py-20">
        <BespokeForm />
      </div>
    </div>
  );
}
