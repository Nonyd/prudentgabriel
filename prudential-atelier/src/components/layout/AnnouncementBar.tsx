"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const MESSAGES = [
  "FREE SHIPPING ON ORDERS OVER ₦150,000 WITHIN LAGOS",
  "NEW COLLECTION — THE EDIT IS NOW LIVE",
  "BOOK YOUR BESPOKE CONSULTATION TODAY",
];

const DISMISSED_KEY = "pa_announcement_dismissed";

export function AnnouncementBar() {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) setVisible(true);

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative flex h-9 shrink-0 items-center justify-center bg-olive px-10 text-center">
      <p className="pr-8 font-body text-[11px] font-normal uppercase tracking-[0.1em] text-white">
        {MESSAGES[index]}
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
