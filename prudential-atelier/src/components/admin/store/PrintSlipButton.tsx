"use client";

export function PrintSlipButton() {
  return (
    <button type="button" onClick={() => window.print()} className="text-choc underline print:hidden">
      Print
    </button>
  );
}
