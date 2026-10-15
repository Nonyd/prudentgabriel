"use client";

import { useState } from "react";

/**
 * Google Maps sets its own cookies, so the embed loads only when she asks for it.
 * The plain link works without loading anything from Google on this page.
 */
export function ContactMap({ embedSrc, mapsLink }: { embedSrc: string; mapsLink: string }) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        title="Lagos Atelier location"
        src={embedSrc}
        width="100%"
        height={400}
        loading="lazy"
        className="rounded-lg border-0"
        style={{ border: 0 }}
      />
    );
  }

  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-lg border border-sand px-6 py-10 text-center sm:min-h-[400px]">
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="min-h-[44px] rounded-sm bg-choc px-5 py-2 font-label text-[12px] font-medium uppercase tracking-[0.12em] text-cream transition-opacity hover:opacity-90"
      >
        Show map
      </button>
      <p className="max-w-sm font-body text-[13px] leading-relaxed text-text-mid">
        Loads Google Maps, which may set its own cookies.
      </p>
      <a
        href={mapsLink}
        target="_blank"
        rel="noopener noreferrer"
        className="font-body text-[13px] text-text-dark underline underline-offset-2 hover:text-choc"
      >
        Open in Google Maps
      </a>
    </div>
  );
}
