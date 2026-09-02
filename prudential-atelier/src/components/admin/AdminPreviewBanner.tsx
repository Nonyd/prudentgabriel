"use client";

import { roleLabel } from "@/lib/roles";

export function AdminPreviewBanner({ previewRole }: { previewRole?: string | null }) {
  if (!previewRole) return null;

  async function exitPreview() {
    await fetch("/api/admin/permissions/preview", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nut/30 bg-[#FFF8F0] px-4 py-2.5 print:hidden md:px-8">
      <p className="font-sans text-sm text-text-dark">
        Viewing the dashboard as <span className="font-medium">{roleLabel(previewRole)}</span>.
        Saves are still yours.
      </p>
      <button
        type="button"
        onClick={() => void exitPreview()}
        className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-nut underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-choc"
      >
        Exit preview
      </button>
    </div>
  );
}
