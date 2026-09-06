"use client";

import { useEffect, useMemo, useState } from "react";

function readableAnnouncement(line: string): string {
  const t = line.trim();
  if (!t) return t;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    const lower = t.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return t;
}

export function AnnouncementBar({
  messages,
  intervalMs = 3000,
}: {
  messages: string[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const list = useMemo(() => messages.filter((m) => m.trim().length > 0), [messages]);

  useEffect(() => {
    setIndex(0);
  }, [list]);

  useEffect(() => {
    if (list.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [list.length, intervalMs]);

  if (list.length === 0) return null;

  const line = readableAnnouncement(list[index % list.length] ?? "");

  return (
    <div className="px-4 py-1.5 text-center">
      <p className="font-body text-[11px] font-normal text-charcoal">{line}</p>
    </div>
  );
}
