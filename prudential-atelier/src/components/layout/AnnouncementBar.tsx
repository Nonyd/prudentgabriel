"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "pa_announcement_dismissed";

export function AnnouncementBar({ messages }: { messages: string[] }) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) setVisible(true);

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % Math.max(1, messages.length));
    }, 3000);

    return () => clearInterval(interval);
  }, [messages]);

  if (!visible) return null;

  const list = messages.filter((m) => m.trim().length > 0);
  const line = list[index % list.length] ?? "";

  return (
    <div className="relative flex h-9 shrink-0 items-center justify-center bg-olive px-10 text-center">
      <p className="pr-8 font-body text-[11px] font-normal uppercase tracking-[0.1em] text-white">
        {line}
      </p>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          localStorage.setItem(DISMISSED_KEY, "1");
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white"
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}
