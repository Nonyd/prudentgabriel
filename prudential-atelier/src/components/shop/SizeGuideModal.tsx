"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { chartRowsForOfferedSizes, formatCmAndInches, normalizeSizeToken, type SizeChartRowView } from "@/lib/sizing";

type Unit = "cm" | "in";
const UNIT_KEY = "pg:size-guide-unit";

const COLUMNS: { key: keyof Omit<SizeChartRowView, "label">; label: string; how: string }[] = [
  { key: "bustCm", label: "Bust", how: "Around the fullest part of the bust, tape level across the back." },
  { key: "waistCm", label: "Waist", how: "Around the natural waist, the narrowest point, without pulling in." },
  { key: "hipCm", label: "Hip", how: "Around the fullest part of the hips, feet together." },
  { key: "lengthCm", label: "Length", how: "Shoulder at the neck down to where you want the hem to fall." },
];

function readUnit(): Unit {
  try {
    return window.localStorage.getItem(UNIT_KEY) === "in" ? "in" : "cm";
  } catch {
    return "cm";
  }
}

function cell(cm: number | null, unit: Unit): string {
  if (cm == null) return "—";
  const both = formatCmAndInches(cm);
  return unit === "cm" ? both.cm : both.in;
}

export function SizeGuideModal({
  children,
  offeredSizes,
  selectedSize,
}: {
  children: React.ReactNode;
  /** Standard sizes this piece is cut in. The house chart is clipped to these. */
  offeredSizes: string[];
  /** The size she has picked on the page, highlighted in the chart. */
  selectedSize?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SizeChartRowView[] | null>(null);
  const [unit, setUnitState] = useState<Unit>("cm");

  useEffect(() => {
    if (!open) return;
    setUnitState(readUnit());
    void fetch("/api/size-chart")
      .then((r) => r.json())
      .then((j: { rows?: SizeChartRowView[] }) => setRows(j.rows ?? []))
      .catch(() => setRows([]));
  }, [open]);

  function setUnit(next: Unit) {
    setUnitState(next);
    try {
      window.localStorage.setItem(UNIT_KEY, next);
    } catch {
      /* the choice just isn't remembered */
    }
  }

  const clipped = rows ? chartRowsForOfferedSizes(rows, offeredSizes) : [];
  // Sizes named differently from the chart should still get measurements, not a dead end.
  const wholeChart = rows != null && clipped.length === 0 && rows.length > 0;
  const shown = wholeChart ? rows : clipped;
  const picked = selectedSize ? normalizeSizeToken(selectedSize) : "";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-charcoal/50 backdrop-blur-[2px]" />
        <Dialog.Content
          data-lenis-prevent
          className="fixed left-1/2 top-1/2 z-[81] max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain glass-3 glass-panel px-4 py-6 sm:px-10 sm:py-9"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.22em] text-charcoal-light">Prudent Gabriel</p>
              <Dialog.Title className="mt-1 font-display text-3xl font-light text-charcoal sm:text-4xl">Size guide</Dialog.Title>
              <Dialog.Description className="mt-2 max-w-md font-body text-sm leading-6 text-charcoal-mid">
                {wholeChart
                  ? "Our house chart. Find the row nearest your measurements."
                  : "The sizes this piece is cut in. If you fall between two, take the larger."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-choc/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="font-label text-[11px] uppercase tracking-[0.16em] text-charcoal-light">Body measurements</p>
            <div role="radiogroup" aria-label="Units" className="inline-flex rounded-full border border-choc/20 p-0.5">
              {(["cm", "in"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unit === u}
                  onClick={() => setUnit(u)}
                  className={clsx(
                    "min-h-[32px] rounded-full px-4 font-label text-xs uppercase tracking-[0.12em] transition-colors",
                    unit === u ? "bg-choc text-cream" : "text-charcoal-mid hover:text-choc",
                  )}
                >
                  {u === "cm" ? "cm" : "inches"}
                </button>
              ))}
            </div>
          </div>

          {rows == null ? (
            <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading size chart">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-sm bg-choc/5" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="mt-6 font-body text-sm leading-6 text-charcoal">
              The house chart is being updated. Choose made to measure, or ask us in the chat and we will size you.
            </p>
          ) : (
            // glass-opaque: figures sit on a solid ground, never on frosted glass (slice AD2).
            <div className="glass-opaque mt-3 overflow-x-auto px-2 py-1 sm:px-4">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Size chart in {unit === "cm" ? "centimetres" : "inches"}</caption>
                <thead>
                  <tr className="border-b border-choc/20">
                    <th scope="col" className="py-3 pr-2 font-label text-[10px] font-medium uppercase tracking-[0.14em] text-charcoal-light sm:pr-4 sm:tracking-[0.18em]">
                      Size
                    </th>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        className="py-3 pr-2 text-right font-label text-[10px] font-medium uppercase tracking-[0.14em] text-charcoal-light last:pr-0 sm:pr-4 sm:tracking-[0.18em]"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const isPicked = picked !== "" && normalizeSizeToken(row.label) === picked;
                    return (
                      <tr
                        key={row.label}
                        aria-current={isPicked ? "true" : undefined}
                        className={clsx(
                          "border-b border-choc/10 transition-colors last:border-b-0",
                          isPicked ? "bg-choc/[0.07]" : "hover:bg-choc/[0.03]",
                        )}
                      >
                        <th scope="row" className="py-3 pl-2 pr-2 text-left font-display text-xl font-normal leading-none text-choc sm:pl-3 sm:pr-4 sm:text-2xl">
                          {row.label}
                          {isPicked ? (
                            <span className="ml-2 hidden align-middle font-label text-[9px] sm:inline uppercase tracking-[0.16em] text-charcoal-light">
                              Your pick
                            </span>
                          ) : null}
                        </th>
                        {COLUMNS.map((c) => (
                          <td
                            key={c.key}
                            className="py-3 pr-2 text-right font-label text-sm tabular-nums text-charcoal last:pr-2 sm:pr-4 sm:text-[15px] sm:last:pr-3"
                          >
                            {cell(row[c.key], unit)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 border-t border-choc/15 pt-6">
            <p className="font-label text-[11px] uppercase tracking-[0.16em] text-charcoal-light">How to measure</p>
            <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {COLUMNS.map((c) => (
                <div key={c.key}>
                  <dt className="font-display text-lg text-charcoal">{c.label}</dt>
                  <dd className="mt-0.5 font-body text-[13px] leading-5 text-charcoal-mid">{c.how}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 font-body text-[13px] leading-5 text-charcoal-mid">
              Measure over light underwear with a soft tape, snug but not tight.{" "}
              <Link href="/size-guide" className="whitespace-nowrap text-choc underline underline-offset-4">
                Full house chart
              </Link>
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
