"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const MESSAGES = [
  "Free shipping on orders over ₦150,000 within Lagos",
  "New collection now available — Shop The Edit",
  "Book a bespoke consultation today",
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
    <div className="relative bg-wine px-4 py-2 text-center">
      <p className="pr-6 font-label text-[11px] uppercase tracking-[0.15em] text-gold/90">
        {MESSAGES[index]}
      </p>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          localStorage.setItem(DISMISSED_KEY, "1");
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/60 transition-colors hover:text-gold"
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}
