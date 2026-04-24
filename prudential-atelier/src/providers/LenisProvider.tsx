"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Lenis from "@studio-freight/lenis";

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (isAdmin) {
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      return;
    }

    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.5,
      infinite: false,
    });

    lenisRef.current = lenis;
    document.documentElement.classList.add("lenis", "lenis-smooth");

    let frame: number;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [isAdmin]);

  return <>{children}</>;
}
