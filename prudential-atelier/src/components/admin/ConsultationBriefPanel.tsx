"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

export type ConsultationBriefData = {
  bookingNumber: string;
  consultationId?: string;
  occasion: string | null;
  outfitBrief: string | null;
  moodboardImages: string[];
  adminHref?: string;
};

export function ConsultationBriefPanel({
  brief,
  variant = "admin",
}: {
  brief: ConsultationBriefData;
  variant?: "admin" | "staff" | "client";
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!brief.outfitBrief && !brief.occasion && brief.moodboardImages.length === 0) {
    return null;
  }

  const heading =
    variant === "client" ? "Your brief" : variant === "staff" ? "Outfit brief" : "Consultation brief";

  return (
    <>
      <section
        className="rounded-md border border-sand p-5 md:px-6 md:py-5"
        style={{ background: "rgba(152,117,91,0.06)" }}
      >
        <h2 className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light">
          {heading}
        </h2>

        {variant === "admin" && brief.consultationId ? (
          <p className="mt-3 font-sans text-sm text-text-mid">
            Linked consultation:{" "}
            <span className="font-medium text-ink">{brief.bookingNumber}</span>{" "}
            <Link
              href={`/admin/consultations/${brief.consultationId}`}
              className="text-nut underline-offset-2 hover:underline"
            >
              View →
            </Link>
          </p>
        ) : null}

        {brief.occasion ? (
          <p className="mt-2 font-sans text-sm text-text-mid">
            {variant === "client" ? "Occasion: " : "Occasion: "}
            <span className="text-ink">{brief.occasion}</span>
          </p>
        ) : null}

        {brief.outfitBrief ? (
          <div className="mt-4">
            <p className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light">
              {variant === "client" ? "What you shared with us" : "Outfit brief"}
            </p>
            <p className="mt-2 font-serif text-sm italic leading-relaxed text-text-mid">
              &ldquo;{brief.outfitBrief}&rdquo;
            </p>
          </div>
        ) : null}

        {brief.moodboardImages.length > 0 ? (
          <div className="mt-4">
            <p className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light">
              {variant === "client" ? "Your moodboard" : "Moodboard reference"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {brief.moodboardImages.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  data-lightbox
                  onClick={() => setLightbox(i)}
                  className="relative h-20 w-20 shrink-0 overflow-hidden !rounded-sm border border-sand"
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="80px" unoptimized />
                </button>
              ))}
            </div>
            {variant === "client" && brief.adminHref ? (
              <Link
                href={brief.adminHref}
                className="mt-3 inline-block font-sans text-xs text-nut underline-offset-2 hover:underline"
              >
                View full moodboard →
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <ImageLightbox
        images={brief.moodboardImages}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onIndex={setLightbox}
      />
    </>
  );
}
