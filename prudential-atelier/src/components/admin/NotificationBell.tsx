"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { AdminNotification, AdminNotificationType } from "@prisma/client";
import {
  BellOff,
  Bell,
  ShoppingCart,
  Scissors,
  Calendar,
  Star,
  AlertTriangle,
  CreditCard,
  User,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";

function iconFor(type: AdminNotificationType) {
  const wrap = (node: ReactNode, bg: string) => (
    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>{node}</span>
  );
  switch (type) {
    case "NEW_ORDER":
      return wrap(<ShoppingCart className="h-4 w-4 text-green-800" strokeWidth={1.5} />, "bg-[#E8F5E9]");
    case "NEW_BESPOKE":
      return wrap(<Scissors className="h-4 w-4 text-purple-900" strokeWidth={1.5} />, "bg-[#F0E8FF]");
    case "NEW_CONSULTATION":
      return wrap(<Calendar className="h-4 w-4 text-blue-900" strokeWidth={1.5} />, "bg-[#E8F4FF]");
    case "REVIEW_PENDING":
      return wrap(<Star className="h-4 w-4 text-amber-800" strokeWidth={1.5} />, "bg-[#FFF8E7]");
    case "LOW_STOCK":
      return wrap(<AlertTriangle className="h-4 w-4 text-red-800" strokeWidth={1.5} />, "bg-[#FDECEA]");
    case "PAYMENT_FAILED":
      return wrap(<CreditCard className="h-4 w-4 text-red-800" strokeWidth={1.5} />, "bg-[#FDECEA]");
    case "NEW_CUSTOMER":
      return wrap(<User className="h-4 w-4 text-green-800" strokeWidth={1.5} />, "bg-[#E8F5E9]");
    case "COUPON_EXPIRING":
      return wrap(<Tag className="h-4 w-4 text-amber-800" strokeWidth={1.5} />, "bg-[#FFF8E7]");
    default:
      return wrap(<Bell className="h-4 w-4 text-charcoal" strokeWidth={1.5} />, "bg-[#F5F5F3]");
  }
}

function timeLabel(createdAt: string) {
  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch {
    return "";
  }
}

type DrawerFilter = "ALL" | "ORDERS" | "BESPOKE" | "CONSULTATIONS" | "REVIEWS" | "STOCK";

function filterMatches(notification: AdminNotification, filter: DrawerFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "ORDERS") return notification.type === "NEW_ORDER" || notification.type === "PAYMENT_FAILED";
  if (filter === "BESPOKE") return notification.type === "NEW_BESPOKE";
  if (filter === "CONSULTATIONS") return notification.type === "NEW_CONSULTATION";
  if (filter === "REVIEWS") return notification.type === "REVIEW_PENDING";
  return notification.type === "LOW_STOCK" || notification.type === "COUPON_EXPIRING";
}

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DrawerFilter>("ALL");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const panelUnread = notifications.filter((n) => !n.isRead).length;

  const pollCount = useCallback(async () => {
    const res = await fetch("/api/admin/notifications/count");
    if (!res.ok) return;
    const j = (await res.json()) as { count: number };
    setUnreadCount((prev) => {
      if (j.count > prev) setPulse(true);
      return j.count;
    });
  }, []);

  useEffect(() => {
    void pollCount();
    const id = window.setInterval(() => void pollCount(), 30_000);
    return () => window.clearInterval(id);
  }, [pollCount]);

  useEffect(() => {
    if (!pulse) return;
    const t = window.setTimeout(() => setPulse(false), 1200);
    return () => window.clearTimeout(t);
  }, [pulse]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const j = (await res.json()) as { notifications: AdminNotification[] };
      setNotifications(j.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  const openDrawer = useCallback(async () => {
    setIsOpen(true);
    await loadNotifications();
    await fetch("/api/admin/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [loadNotifications]);

  async function markAllRead() {
    await fetch("/api/admin/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const badge = unreadCount > 9 ? "9+" : String(Math.max(0, unreadCount));
  const filtered = notifications.filter((notification) => filterMatches(notification, selectedFilter));
  const tabs: { id: DrawerFilter; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "ORDERS", label: "Orders" },
    { id: "BESPOKE", label: "Bespoke" },
    { id: "CONSULTATIONS", label: "Consultations" },
    { id: "REVIEWS", label: "Reviews" },
    { id: "STOCK", label: "Stock" },
  ];

  return (
    <>
      <button
        type="button"
        className="relative p-1.5 text-[#6B6B68] transition-colors hover:text-olive"
        aria-label="Notifications"
        onClick={() => void openDrawer()}
      >
        <Bell size={16} strokeWidth={1.5} />
        <AnimatePresence>
          {unreadCount > 0 ? (
            <motion.span
              key={badge}
              initial={{ scale: 0.6 }}
              animate={{ scale: pulse ? [1, 1.15, 1] : 1 }}
              exit={{ scale: 0.6 }}
              transition={{ duration: 0.35 }}
              className="absolute right-0 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#37392d] px-0.5 font-body text-[9px] font-semibold text-white"
            >
              {badge}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications drawer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l border-[#EBEBEA] bg-white"
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="border-b border-[#EBEBEA] px-6 py-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[22px] text-[#111]">Notifications</h3>
                  <button type="button" onClick={() => setIsOpen(false)} className="text-[#5E5E5B] hover:text-[#111]">
                    <X size={18} />
                  </button>
                </div>
                {panelUnread > 0 ? (
                  <p className="mt-1 font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">{panelUnread} unread</p>
                ) : null}
              </div>

              <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-[#EBEBEA] px-4 py-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedFilter(tab.id)}
                    className={`whitespace-nowrap border-b-2 px-2 py-2 font-body text-[11px] uppercase tracking-[0.08em] ${
                      selectedFilter === tab.id
                        ? "border-[#37392d] text-[#37392d]"
                        : "border-transparent text-[#6B6B68] hover:text-[#111]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto" data-lenis-prevent>
                {loading ? (
                  <div className="p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="mb-3 h-16 animate-pulse bg-[#F5F5F3]" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <BellOff className="h-8 w-8 text-[#EBEBEA]" strokeWidth={1.5} />
                    <p className="mt-3 font-body text-sm text-[#6B6B68]">No notifications</p>
                    <p className="font-body text-xs text-[#6B6B68]/70">You&apos;re all caught up!</p>
                  </div>
                ) : (
                  <ul>
                    {filtered.map((n) => (
                      <li key={n.id} className="border-b border-[#F5F5F3]">
                        <button
                          type="button"
                          className={`flex w-full items-start gap-3 px-6 py-4 text-left ${
                            !n.isRead ? "border-l-[3px] border-l-[#37392d] bg-[#FAFAF8]" : "bg-white"
                          }`}
                          onClick={async () => {
                            if (!n.isRead) {
                              await fetch("/api/admin/notifications/read", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: n.id }),
                              });
                              setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
                            }
                            router.push(n.link || "/admin");
                            setIsOpen(false);
                          }}
                        >
                          {iconFor(n.type)}
                          <div className="min-w-0 flex-1">
                            <p className="font-body text-[13px] font-medium text-[#111]">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 font-body text-[12px] font-light text-[#4A4A47]">{n.message}</p>
                            <p className="mt-1 font-body text-[10px] text-[#6B6B68]/80">{timeLabel(n.createdAt.toString())}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[#EBEBEA] px-6 py-4">
                <button type="button" onClick={() => void markAllRead()} className="font-body text-[11px] text-[#6B6B68] hover:text-[#111]">
                  Mark All Read
                </button>
                <Link
                  href="/admin/notifications"
                  onClick={() => setIsOpen(false)}
                  className="font-body text-[11px] text-[#37392d] hover:underline"
                >
                  View All Notifications →
                </Link>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
