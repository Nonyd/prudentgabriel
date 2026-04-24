"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

interface CountdownTimerProps {
  endsAt: Date | string;
  className?: string;
}

export function CountdownTimer({ endsAt, className }: CountdownTimerProps) {
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = end.getTime() - now;
  if (diff <= 0) {
    return <p className={cn("font-label text-sm text-charcoal-light", className)}>Sale ended</p>;
  }

  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const urgent = diff < 60 * 60 * 1000;

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap gap-3 font-label text-xs uppercase tracking-wider",
        urgent ? "text-wine" : "text-charcoal-mid",
        className,
      )}
    >
      <span>
        {d}d {pad(h)}h {pad(m)}m {pad(sec)}s
      </span>
      <span className="text-charcoal-light">Ends soon</span>
    </div>
  );
}
