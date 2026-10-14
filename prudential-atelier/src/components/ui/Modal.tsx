"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  // Portalled to <body>: page content sits in its own stacking layer, which
  // would otherwise leave the header and admin sidebar above the backdrop.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 rounded-none bg-choc/40 backdrop-blur-[2px]"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto glass-3 glass-panel p-6",
          className,
        )}
      >
        <h2 id="modal-title" className="font-serif text-xl font-medium text-choc">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 font-sans text-sm font-light text-text-mid">{description}</p>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
