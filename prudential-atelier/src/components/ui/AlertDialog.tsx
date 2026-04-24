"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  loading,
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm" />
        <AlertDialogPrimitive.Content
          data-lenis-prevent
          className={cn(
            "fixed left-1/2 top-1/2 z-[101] max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-sm border border-border bg-[var(--white)] p-6 shadow-xl",
          )}
        >
          <AlertDialogPrimitive.Title
            className={cn(
              "font-display text-[22px] text-charcoal",
              variant === "danger" && "text-[var(--error)]",
            )}
          >
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 font-body text-sm text-charcoal-mid">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialogPrimitive.Cancel asChild>
              <button
                type="button"
                className="rounded-sm border border-charcoal-mid px-4 py-2 font-label text-xs uppercase tracking-wide text-charcoal hover:bg-ivory-dark"
              >
                {cancelLabel}
              </button>
            </AlertDialogPrimitive.Cancel>
            <button
              type="button"
              disabled={loading}
              onClick={() => void onConfirm()}
              className={cn(
                "inline-flex min-w-[120px] items-center justify-center gap-2 rounded-sm px-4 py-2 font-label text-xs uppercase tracking-wide text-ivory disabled:opacity-50",
                variant === "danger" && "bg-wine hover:bg-wine-hover",
                variant === "warning" && "bg-gold text-charcoal hover:bg-gold-hover",
              )}
            >
              {loading ? <Spinner size="sm" /> : null}
              {confirmLabel}
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
