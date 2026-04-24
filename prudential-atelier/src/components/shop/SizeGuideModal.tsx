"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import Link from "next/link";

const DRESSES = [
  ["XS", "76-80", "58-62", "84-88", "155-162"],
  ["S", "82-86", "64-68", "90-94", "158-165"],
  ["M", "88-92", "70-74", "96-100", "162-168"],
  ["L", "94-98", "76-80", "102-106", "165-172"],
  ["XL", "100-104", "82-86", "108-112", "168-175"],
  ["XXL", "106-112", "88-94", "114-120", "170-178"],
];

const UK = [
  ["UK 8", "81", "63", "89", "158-163"],
  ["UK 10", "86", "68", "94", "160-165"],
  ["UK 12", "91", "73", "99", "162-167"],
  ["UK 14", "96", "78", "104", "164-169"],
  ["UK 16", "101", "83", "109", "166-171"],
];

const KIDDIES = [
  ["Age 2-3", "54", "51", "55", "88-96"],
  ["Age 4-5", "58", "54", "59", "98-108"],
  ["Age 6-7", "62", "57", "63", "110-120"],
  ["Age 8-10", "67", "61", "68", "122-135"],
  ["Age 9-12", "73", "65", "74", "135-150"],
];

function Table({ rows }: { rows: string[][] }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="py-2 pr-2 font-label text-[10px] uppercase">Size</th>
          <th className="py-2 pr-2 font-label text-[10px] uppercase">Bust</th>
          <th className="py-2 pr-2 font-label text-[10px] uppercase">Waist</th>
          <th className="py-2 pr-2 font-label text-[10px] uppercase">Hips</th>
          <th className="py-2 font-label text-[10px] uppercase">Height</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]} className="border-b border-border/60">
            {r.map((c) => (
              <td key={c} className="py-2 pr-2 text-charcoal">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SizeGuideModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
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
            <Dialog.Close className="rounded-sm p-2 hover:bg-wine-muted" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Tabs.Root defaultValue="dresses">
            <Tabs.List className="mb-4 flex gap-2 border-b border-border">
              {["dresses", "suits", "kiddies"].map((t) => (
                <Tabs.Trigger
                  key={t}
                  value={t}
                  className="border-b-2 border-transparent px-3 py-2 font-label text-[10px] uppercase data-[state=active]:border-wine data-[state=active]:text-wine"
                >
                  {t === "dresses" ? "Dresses" : t === "suits" ? "Suits" : "Kiddies"}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value="dresses">
              <Table rows={DRESSES} />
            </Tabs.Content>
            <Tabs.Content value="suits">
              <Table rows={UK} />
            </Tabs.Content>
            <Tabs.Content value="kiddies">
              <Table rows={KIDDIES} />
            </Tabs.Content>
          </Tabs.Root>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-charcoal-light">
            <p>For bespoke pieces, we take exact measurements. All sizes in centimetres.</p>
            <Link href="/bespoke" className="font-label text-wine underline">
              Book Bespoke
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
