"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { X, SlidersHorizontal } from "lucide-react";
import { FilterPanel } from "@/components/shop/FilterPanel";
import { cn } from "@/lib/utils";

type FilterDrawerProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When uncontrolled, render a default trigger button */
  showTrigger?: boolean;
  triggerClassName?: string;
};

export function FilterDrawer({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  triggerClassName,
}: FilterDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {showTrigger && controlledOpen === undefined && (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-12 items-center gap-2 border-0 bg-transparent px-0 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal hover:text-olive",
              triggerClassName,
            )}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Filter
          </button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-charcoal/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          data-lenis-prevent
          className="fixed left-0 top-0 z-50 flex h-full w-full max-w-[300px] flex-col border-r border-mid-grey bg-canvas shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out max-sm:max-w-none"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-mid-grey px-5 py-5">
            <Dialog.Title className="font-body text-[11px] font-medium uppercase tracking-[0.2em] text-ink">
              Filter
            </Dialog.Title>
            <Dialog.Close
              className="p-2 text-dark-grey transition-colors hover:text-charcoal"
              aria-label="Close filters"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <FilterPanel />
          </div>
          <div className="shrink-0 border-t border-mid-grey bg-canvas p-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="h-10 w-full bg-olive font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
              >
                Apply filters
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Link
                href="/shop"
                className="mt-3 block w-full text-left font-body text-[12px] text-dark-grey underline-offset-2 hover:text-olive hover:underline"
              >
                Clear all
              </Link>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
