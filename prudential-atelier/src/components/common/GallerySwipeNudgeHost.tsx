"use client";

import { useEffect, type ReactNode } from "react";
import { cardIsMeaningfullyInViewport } from "@/lib/product-gallery";
import {
  consumeGalleryNudge,
  galleryNudgeStillAvailable,
} from "@/lib/gallery-swipe-session";

const IDLE_MS = 220;

function firstCardInView(): HTMLElement | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-gallery-card]"));
  for (const card of cards) {
    if (cardIsMeaningfullyInViewport(card.getBoundingClientRect(), window.innerHeight)) {
      return card;
    }
  }
  return null;
}

function tryNudge(): void {
  if (!galleryNudgeStillAvailable()) return;
  if (window.matchMedia("(min-width: 768px)").matches) return;

  const card = firstCardInView();
  if (!card) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const strip = card.querySelector("[data-gallery-swipe]");
  if (!strip) {
    consumeGalleryNudge(true);
    return;
  }
  if (!consumeGalleryNudge(reduced)) return;
  strip.dispatchEvent(new Event("gallery-nudge"));
}

/** Plays the once-per-session peek when a product grid is at rest. */
export function GallerySwipeNudgeHost({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!galleryNudgeStillAvailable()) return;

    let idle: number | null = null;
    const arm = () => {
      if (idle != null) window.clearTimeout(idle);
      idle = window.setTimeout(tryNudge, IDLE_MS);
    };

    arm();
    window.addEventListener("scroll", arm, { passive: true, capture: true });
    return () => {
      if (idle != null) window.clearTimeout(idle);
      window.removeEventListener("scroll", arm, true);
    };
  }, []);

  return <>{children}</>;
}