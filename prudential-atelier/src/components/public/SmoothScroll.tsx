"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "@studio-freight/lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skipLenis =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/admin-login") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/staff-login") ||
    pathname?.startsWith("/staff") ||
    pathname?.startsWith("/account") ||
    pathname?.startsWith("/checkout") ||
    pathname?.startsWith("/payment") ||
    pathname?.startsWith("/auth");

  useEffect(() => {
    if (skipLenis) {
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      return;
    }

    if (window.matchMedia("(pointer: coarse)").matches) {
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      return;
    }

    const lenis = new Lenis({
      duration: 0.72,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    document.documentElement.classList.add("lenis", "lenis-smooth");
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      lenis.destroy();
    };
  }, [skipLenis]);

  return <>{children}</>;
}
