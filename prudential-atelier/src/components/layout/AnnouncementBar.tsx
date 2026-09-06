"use client";

import { useEffect, useMemo, useState } from "react";

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

  const line = list[index % list.length] ?? "";

  return (
    <div className="px-4 py-1.5 text-center">
      <p
        className="font-sans text-[10px] font-normal"
        style={{
          color: "var(--ivory-deep)",
          textShadow: "0 1px 12px rgb(68 41 19 / 0.9)",
        }}
      >
        {line}
      </p>
    </div>
  );
}
