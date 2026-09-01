"use client";

export function PrintGuideButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-sm border border-sand px-4 py-2 text-sm text-gold hover:bg-gold/10 print:hidden"
    >
      Print / save as PDF
    </button>
  );
}
