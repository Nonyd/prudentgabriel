"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { StaffNotification, StaffNotificationType } from "@prisma/client";
import { Bell, Calendar, Check, ClipboardList, Package } from "lucide-react";
import Link from "next/link";

function iconFor(type: StaffNotificationType) {
  const wrap = (node: ReactNode, bg: string) => (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>{node}</span>
  );
  switch (type) {
    case "JOB_ASSIGNED":
    case "TASK_ASSIGNED":
      return wrap(<ClipboardList className="h-4 w-4 text-choc" strokeWidth={1.5} />, "bg-nut/15");
    case "ORDER_UPDATE":
      return wrap(<Package className="h-4 w-4 text-nut" strokeWidth={1.5} />, "bg-sand/50");
    case "SCHEDULE":
      return wrap(<Calendar className="h-4 w-4 text-lightbr" strokeWidth={1.5} />, "bg-lightbr/20");
    default:
      return wrap(<Bell className="h-4 w-4 text-nut" strokeWidth={1.5} />, "bg-sand/50");
  }
}

function timeLabel(createdAt: string) {
  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch {
    return "";
  }
}

export function StaffNotificationBell() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);

  const pollCount = useCallback(async () => {
    const res = await fetch("/api/staff/notifications/count");
    if (!res.ok) return;
    const j = (await res.json()) as { count: number };
    setUnreadCount((prev) => {
      if (j.count > prev) setPulse(true);
      return j.count;
    });
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff/notifications");
      if (!res.ok) return;
      const j = (await res.json()) as { notifications: StaffNotification[]; unreadCount?: number };
      setNotifications(j.notifications.slice(0, 10));
      if (typeof j.unreadCount === "number") setUnreadCount(j.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void pollCount();
    const id = window.setInterval(() => void pollCount(), 60_000);
    return () => window.clearInterval(id);
  }, [pollCount]);

  useEffect(() => {
    if (!pulse) return;
    const t = window.setTimeout(() => setPulse(false), 1200);
    return () => window.clearTimeout(t);
  }, [pulse]);

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen]);

  const toggleOpen = useCallback(async () => {
    if (!isOpen) {
      setIsOpen(true);
      await loadNotifications();
    } else {
      setIsOpen(false);
    }
  }, [isOpen, loadNotifications]);

  async function markAllRead() {
    await fetch("/api/staff/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function openNotification(n: StaffNotification) {
    if (!n.isRead) {
      await fetch("/api/staff/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    router.push(n.link || "/staff/notifications");
    setIsOpen(false);
  }

  const badge = unreadCount > 9 ? "9+" : String(Math.max(0, unreadCount));

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative p-2 text-text-mid transition-colors hover:text-choc"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={() => void toggleOpen()}
      >
        <Bell size={18} strokeWidth={1.5} />
        <AnimatePresence>
          {unreadCount > 0 ? (
            <motion.span
              key={badge}
              initial={{ scale: 0.6 }}
              animate={{ scale: pulse ? [1, 1.15, 1] : 1 }}
              exit={{ scale: 0.6 }}
              transition={{ duration: 0.35 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-0.5 font-sans text-[9px] font-semibold text-white"
            >
              {badge}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-sand bg-ivory shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          >
            <div className="flex items-center justify-between border-b border-sand px-4 py-3">
              <h3 className="font-sans text-sm font-semibold text-choc">Notifications</h3>
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="font-sans text-[11px] text-nut hover:underline"
              >
                Mark all ✓
              </button>
            </div>

            <ul className="max-h-[480px] overflow-y-auto" data-lenis-prevent>
              {loading ? (
                <li className="p-4 font-sans text-sm text-text-mid">Loading…</li>
              ) : notifications.length === 0 ? (
                <li className="p-8 text-center font-sans text-sm text-text-mid">No notifications yet.</li>
              ) : (
                notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(152,117,91,0.06)] ${
                        !n.isRead ? "border-l-[3px] border-l-nut bg-[rgba(92,52,34,0.04)]" : ""
                      }`}
                      onClick={() => void openNotification(n)}
                    >
                      {iconFor(n.type)}
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[13px] font-medium text-choc">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 font-sans text-[11px] font-light text-text-mid">
                          {n.message}
                        </p>
                        <p className="mt-1 font-sans text-[11px] text-text-light">{timeLabel(n.createdAt.toString())}</p>
                      </div>
                      {n.isRead ? (
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-text-light" strokeWidth={1.5} />
                      ) : (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-nut" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="border-t border-sand px-4 py-3 text-center">
              <Link
                href="/staff/notifications"
                onClick={() => setIsOpen(false)}
                className="font-sans text-[11px] text-nut hover:underline"
              >
                View all notifications →
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
