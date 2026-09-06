"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { AdminNotificationType } from "@prisma/client";
import {
  Bell,
  Briefcase,
  Calendar,
  Check,
  CreditCard,
  FileText,
  AlertTriangle,
  Banknote,
  Scissors,
} from "lucide-react";
import Link from "next/link";
import type { AdminNotificationRow } from "@/lib/admin-notification-access";

function iconFor(type: AdminNotificationType) {
  const wrap = (node: ReactNode, bg: string) => (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>{node}</span>
  );
  switch (type) {
    case "NEW_CONSULTATION":
    case "CONSULTATION_COMPLETED":
    case "CONSULTATION_BOOKED_PRUDENT":
    case "QUOTE_AWAITING":
      return wrap(<Calendar className="h-4 w-4 text-lightbr" strokeWidth={1.5} />, "bg-lightbr/20");
    case "PAYMENT_FAILED":
      return wrap(<CreditCard className="h-4 w-4 text-danger" strokeWidth={1.5} />, "bg-danger/10");
    case "RTW_OVERSELL":
      return wrap(<Banknote className="h-4 w-4 text-danger" strokeWidth={1.5} />, "bg-danger/10");
    case "NEW_ORDER":
    case "BANK_TRANSFER_RECEIPT":
      return wrap(<CreditCard className="h-4 w-4 text-success" strokeWidth={1.5} />, "bg-success/15");
    case "NEW_BESPOKE":
    case "QUOTE_APPROVED":
    case "STAGE_COMPLETED":
    case "PRODUCTION_UNLOCKED":
    case "PRODUCTION_RELOCKED":
    case "STAGE_APPROVAL_RESPONSE":
      return wrap(<Scissors className="h-4 w-4 text-choc" strokeWidth={1.5} />, "bg-nut/15");
    case "CONTACT_FORM":
      return wrap(<FileText className="h-4 w-4 text-nut" strokeWidth={1.5} />, "bg-nut/15");
    case "REVIEW_PENDING":
    case "TESTIMONIAL_SUBMITTED":
      return wrap(<FileText className="h-4 w-4 text-warning" strokeWidth={1.5} />, "bg-warning/15");
    case "JOB_APPLICATION":
      return wrap(<Briefcase className="h-4 w-4 text-olive" strokeWidth={1.5} />, "bg-olive/15");
    case "LOW_STOCK":
      return wrap(<AlertTriangle className="h-4 w-4 text-danger" strokeWidth={1.5} />, "bg-danger/10");
    default:
      return wrap(<Bell className="h-4 w-4 text-nut" strokeWidth={1.5} />, "bg-sand/50");
  }
}

function timeLabel(createdAt: string | Date) {
  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);

  const pollCount = useCallback(async () => {
    const res = await fetch("/api/admin/notifications/count");
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
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const j = (await res.json()) as { notifications: AdminNotificationRow[]; unreadCount?: number };
      setNotifications(j.notifications.filter((n) => !n.acknowledgedAt).slice(0, 10));
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
    await fetch("/api/admin/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function openNotification(n: AdminNotificationRow) {
    if (!n.isRead) {
      await fetch("/api/admin/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    router.push(n.link || "/admin/notifications");
    setIsOpen(false);
  }

  const badge = unreadCount > 9 ? "9+" : String(Math.max(0, unreadCount));

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative min-h-11 min-w-11 p-1.5 text-text-mid transition-colors hover:text-choc"
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
            className="glass-1 glass-panel absolute right-0 top-full z-50 mt-2 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden"
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
                        <p className="mt-0.5 line-clamp-2 font-sans text-[11px] font-light text-text-light">
                          {n.message}
                        </p>
                        <p className="mt-1 font-sans text-[11px] text-text-light">{timeLabel(n.createdAt)}</p>
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
                href="/admin/notifications"
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
