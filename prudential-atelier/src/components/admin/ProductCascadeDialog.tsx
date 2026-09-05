"use client";

import { useEffect, useState } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { CASCADE_CONFIRMATION, type CascadeDialogCopy } from "@/lib/cascade-copy";

type Props = {
  open: boolean;
  copy: CascadeDialogCopy | null;
  loadingPreview: boolean;
  submitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (confirmation?: string) => void;
};

export function ProductCascadeDialog(props: Props) {
  return <CascadeConfirmDialog {...props} />;
}

export function CascadeConfirmDialog({
  open,
  copy,
  loadingPreview,
  submitting,
  error,
  onOpenChange,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const loud = Boolean(copy?.loud);
  const blocked = Boolean(copy?.blocked);
  const canConfirm =
    Boolean(copy) && !loadingPreview && !blocked && (!loud || typed === CASCADE_CONFIRMATION);

  useEffect(() => {
    if (!open) setTyped("");
  }, [open, copy]);

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm" />
        <AlertDialogPrimitive.Content
          data-lenis-prevent
          className="fixed left-1/2 top-1/2 z-[101] max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-sm border border-border bg-[var(--white)] p-6 shadow-xl"
        >
          <AlertDialogPrimitive.Title className="font-display text-[22px] text-[var(--error)]">
            {copy?.title ?? "Delete"}
          </AlertDialogPrimitive.Title>
          {loadingPreview || !copy ? (
            <p className="mt-3 font-body text-sm text-charcoal-mid">Checking what is attached…</p>
          ) : (
            <div className="mt-3 space-y-2 font-body text-sm text-charcoal">
              <p className="font-medium">{copy.heading}</p>
              {copy.lines.map((line) => (
                <p key={line} className={line.startsWith("·") ? "text-charcoal" : "text-charcoal-mid"}>
                  {line}
                </p>
              ))}
            </div>
          )}
          {loud && copy && !blocked ? (
            <label className="mt-4 block font-body text-sm text-charcoal">
              Type {CASCADE_CONFIRMATION} to confirm
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-sm border border-sand px-3 py-2 font-mono text-sm tracking-wide"
              />
            </label>
          ) : null}
          {error ? <p className="mt-3 font-body text-sm text-[var(--error)]">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialogPrimitive.Cancel asChild>
              <button
                type="button"
                className="rounded-sm border border-charcoal-mid px-4 py-2 font-label text-xs uppercase tracking-wide text-charcoal hover:bg-ivory-dark"
              >
                {blocked ? "Close" : "Cancel"}
              </button>
            </AlertDialogPrimitive.Cancel>
            {blocked ? null : (
              <button
                type="button"
                disabled={!canConfirm || submitting}
                onClick={() => onConfirm(loud ? typed : undefined)}
                className={cn(
                  "inline-flex min-w-[120px] items-center justify-center gap-2 rounded-sm bg-wine px-4 py-2 font-label text-xs uppercase tracking-wide text-ivory hover:bg-wine-hover disabled:opacity-50",
                )}
              >
                {submitting ? <Spinner size="sm" /> : null}
                Delete
              </button>
            )}
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
