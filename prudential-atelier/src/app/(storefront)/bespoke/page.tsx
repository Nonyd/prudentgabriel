"use client";

import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BespokeForm } from "@/components/bespoke/BespokeForm";

export default function BespokePage() {
  return (
    <div>
      <div className="relative flex h-[400px] items-center justify-center bg-charcoal text-center">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519741497674-611481863552?w=1400')] bg-cover bg-center opacity-40" />
        <div className="absolute inset-0 bg-charcoal/70" />
        <div className="relative z-[1] px-4">
          <SectionLabel className="text-ivory">THE ATELIER</SectionLabel>
          <h1 className="mt-4 font-display text-4xl italic text-ivory md:text-5xl">
            Your Vision,
            <br />
            Our Craft.
          </h1>
          <p className="mt-4 font-body text-ivory/70">Every bespoke piece begins with a conversation.</p>
        </div>
      </div>
      <div className="border-b border-gold/20 bg-ivory-dark px-4 py-6">
        <div className="mx-auto flex max-w-site flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-charcoal">
            Looking to discuss your vision before committing? Book a consultation first.
          </p>
          <Link href="/consultation" className="shrink-0 font-label text-sm text-gold underline">
            Book a Consultation →
          </Link>
        </div>
      </div>
      <div className="bg-ivory-dark py-16">
        <div className="mx-auto grid max-w-site gap-8 px-4 md:grid-cols-4">
          {["Consultation", "Design & Fabric", "Fitting", "Delivery"].map((t, i) => (
            <div key={t} className="text-center">
              <p className="font-display text-4xl text-wine/30">0{i + 1}</p>
              <p className="font-display text-lg text-wine">{t}</p>
              <p className="mt-2 text-sm text-charcoal-mid">A dedicated step in your journey.</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-site px-4 py-16">
        <BespokeForm />
      </div>
    </div>
  );
}
