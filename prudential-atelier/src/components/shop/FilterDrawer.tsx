"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FilterPanel } from "@/components/shop/FilterPanel";

export function FilterDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
        Filter &amp; Sort
      </Button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-charcoal/60" />
          <Dialog.Content
            data-lenis-prevent
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-lg bg-[var(--white)] p-4 shadow-xl lg:hidden"
          >
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="font-display text-lg text-charcoal">Filters</Dialog.Title>
              <Dialog.Close className="rounded-sm p-2 hover:bg-wine-muted" aria-label="Close">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <FilterPanel />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
