"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import type { StaffNotification } from "@prisma/client";
import { Loader2 } from "lucide-react";

export default function StaffNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff/notifications");
      if (!res.ok) return;
      const j = (await res.json()) as { notifications: StaffNotification[] };
      setItems(j.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openItem(n: StaffNotification) {
    if (!n.isRead) {
      await fetch("/api/staff/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    router.push(n.link || "/staff");
  }

  async function markAllRead() {
    await fetch("/api/staff/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-choc" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-choc md:text-3xl">Notifications</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">Job assignments and updates for your work.</p>
        </div>
        {items.some((n) => !n.isRead) ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="font-sans text-sm text-nut hover:underline"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-sand bg-bg-card p-6 font-sans text-sm text-text-mid">
          No notifications yet.
        </p>
      ) : (
        <ul className="staff-card divide-y divide-sand overflow-hidden">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={`flex w-full flex-col items-start gap-1 px-4 py-4 text-left transition-colors hover:bg-sand/20 md:px-5 ${
                  !n.isRead ? "bg-[rgba(92,52,34,0.04)]" : ""
                }`}
                onClick={() => void openItem(n)}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <p className="font-sans text-sm font-medium text-choc">{n.title}</p>
                  {!n.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-nut" /> : null}
                </div>
                <p className="font-sans text-sm text-text-mid">{n.message}</p>
                <p className="font-sans text-xs text-text-light">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
