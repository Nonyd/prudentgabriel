"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { displayChartRow, type SizeChartRowView } from "@/lib/sizing";

export function SizeGuideModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SizeChartRowView[] | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/size-chart")
      .then((r) => r.json())
      .then((j: { rows?: SizeChartRowView[] }) => setRows(j.rows ?? []))
      .catch(() => setRows([]));
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-charcoal/50" />
        <Dialog.Content
          data-lenis-prevent
          className="fixed left-1/2 top-1/2 z-[81] max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-sm bg-[var(--white)] p-6 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-display text-xl text-charcoal">Size Guide</Dialog.Title>
            <Dialog.Close className="rounded-sm p-2 hover:bg-cream" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {rows == null ? (
            <p className="text-sm text-charcoal-mid">Loading…</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-2 font-label text-[10px] uppercase">Size</th>
                  <th className="py-2 pr-2 font-label text-[10px] uppercase">Bust</th>
                  <th className="py-2 pr-2 font-label text-[10px] uppercase">Waist</th>
                  <th className="py-2 pr-2 font-label text-[10px] uppercase">Hip</th>
                  <th className="py-2 font-label text-[10px] uppercase">Length</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const d = displayChartRow(row);
                  return (
                    <tr key={row.label} className="border-b border-border/60">
                      <td className="py-2 pr-2 font-medium text-choc">{d.label}</td>
                      <td className="py-2 pr-2 text-charcoal">{d.bust}</td>
                      <td className="py-2 pr-2 text-charcoal">{d.waist}</td>
                      <td className="py-2 pr-2 text-charcoal">{d.hip}</td>
                      <td className="py-2 text-charcoal">{d.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-charcoal-light">
            <p>Figures in centimetres and inches. Between sizes? Size up, or have it made to your measurements.</p>
            <Link href="/size-guide" className="font-label text-choc underline">
              Full size guide
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
