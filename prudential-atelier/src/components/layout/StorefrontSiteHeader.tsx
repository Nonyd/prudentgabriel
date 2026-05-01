"use client";

import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

export function StorefrontSiteHeader({ messages }: { messages: string[] }) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      setSpacerHeight(Math.ceil(h));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 w-full bg-[var(--white)]"
      >
        <AnnouncementBar messages={messages} />
        <Suspense
          fallback={
            <div className="h-[60px] border-b border-mid-grey bg-[var(--white)] lg:h-[72px]" aria-hidden />
          }
        >
          <Navbar />
        </Suspense>
      </div>
      <div
        className={cn("shrink-0", spacerHeight === undefined && "min-h-[60px] lg:min-h-[72px]")}
        style={spacerHeight !== undefined ? { height: spacerHeight } : undefined}
        aria-hidden
      />
    </>
  );
}
