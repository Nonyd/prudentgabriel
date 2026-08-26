"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { QuickAddStickyBar } from "@/components/common/quick-add/QuickAddMobile";
import { useQuickAddStore } from "@/store/quickAddStore";

export function QuickAddHost() {
  const pathname = usePathname();
  const productId = useQuickAddStore((s) => s.product?.id ?? null);
  const phase = useQuickAddStore((s) => s.phase);
  const error = useQuickAddStore((s) => s.error);
  const close = useQuickAddStore((s) => s.close);
  const productName = useQuickAddStore((s) => s.product?.name ?? "");
  const lastTrigger = useRef<string | null>(null);

  useEffect(() => {
    if (productId) lastTrigger.current = productId;
  }, [productId]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!productId) {
      const id = lastTrigger.current;
      if (!id) return;
      const nodes = document.querySelectorAll<HTMLElement>(`[data-quick-add-trigger="${id}"]`);
      const visible = Array.from(nodes).find((el) => el.offsetParent !== null) ?? nodes[0];
      visible?.focus();
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest("[data-quick-add]")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    const attach = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointer);
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(attach);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [productId, close]);

  const live =
    phase === "submitting"
      ? "Adding to bag"
      : phase === "done"
        ? `${productName} added to bag`
        : error
          ? error
          : phase === "sizes"
            ? `Select a size for ${productName}`
            : "";

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </div>
      <QuickAddStickyBar />
    </>
  );
}
