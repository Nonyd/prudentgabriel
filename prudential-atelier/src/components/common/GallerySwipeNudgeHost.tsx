"use client";

import { useEffect, type ReactNode } from "react";
import { cardIsMeaningfullyInViewport, firstEligibleNudgeCard } from "@/lib/product-gallery";
import {
  consumeGalleryNudge,
  galleryNudgeStillAvailable,
} from "@/lib/gallery-swipe-session";

const IDLE_MS = 220;

function firstSwipeCardInView(): HTMLElement | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-gallery-card]"));
  const index = firstEligibleNudgeCard(
    cards.map((card) => ({
      inView: cardIsMeaningfullyInViewport(card.getBoundingClientRect(), window.innerHeight),
      hasSwipe: Boolean(card.querySelector("[data-gallery-swipe]")),
    })),
  );
  return index == null ? null : cards[index] ?? null;
}

function tryNudge(): void {
  if (!galleryNudgeStillAvailable()) return;
  if (window.matchMedia("(min-width: 768px)").matches) return;

  const card = firstSwipeCardInView();
  if (!card) return;

  const strip = card.querySelector("[data-gallery-swipe]");
  if (!strip) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!consumeGalleryNudge(reduced)) return;
  strip.dispatchEvent(new Event("gallery-nudge"));
}

/** Plays the once-per-session peek when a product grid is at rest. */
export function GallerySwipeNudgeHost({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!galleryNudgeStillAvailable()) return;

    let idle: number | null = null;
    let tries = 0;
    const arm = () => {
      if (idle != null) window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        tryNudge();
        tries += 1;
        // Cards mount swipe after matchMedia; keep waiting until one exists or we give up.
        if (galleryNudgeStillAvailable() && tries < 15) arm();
      }, IDLE_MS);
    };

    arm();
    const onScroll = () => {
      tries = 0;
      arm();
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      if (idle != null) window.clearTimeout(idle);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  return <>{children}</>;
}