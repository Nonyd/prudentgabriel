"use client";

import toast from "react-hot-toast";

export function CopyReferralClient({ link }: { link: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(link).then(() => toast.success("Copied"));
        }}
        className="rounded-sm bg-gold/20 px-4 py-2 text-xs font-medium text-gold hover:bg-gold/30"
      >
        Copy link
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Join me at Prudential Atelier:\n${link}`)}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-sm border border-ivory/40 px-4 py-2 text-xs text-ivory hover:bg-ivory/10"
      >
        WhatsApp
      </a>
    </div>
  );
}
