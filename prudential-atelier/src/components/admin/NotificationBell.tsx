"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { AdminNotification, AdminNotificationType } from "@prisma/client";
import {
  Bell,
  ShoppingCart,
  Scissors,
  Calendar,
  Star,
  AlertTriangle,
  CreditCard,
  User,
  Tag,
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

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [panelUnread, setPanelUnread] = useState(0);

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

  const onOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/notifications");
        if (res.ok) {
          const j = (await res.json()) as { notifications: AdminNotification[]; unreadCount: number };
          setPanelUnread(j.unreadCount);
          setNotifications(j.notifications);
          await fetch("/api/admin/notifications/read", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
          });
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          setUnreadCount(0);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const badge = unreadCount > 9 ? "9+" : String(Math.max(0, unreadCount));

  return (
    <Popover.Root open={open} onOpenChange={(v) => void onOpenChange(v)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative p-1.5 text-[#6B6B68] transition-colors hover:text-olive"
          aria-label="Notifications"
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
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-[200] w-[380px] max-h-[480px] overflow-y-auto border border-[#EBEBEA] bg-white shadow-lg outline-none"
        >
          <div className="border-b border-[#EBEBEA] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-body text-xs font-medium uppercase tracking-[0.1em] text-black">Notifications</p>
              <span className="font-body text-[11px] text-[#37392d]">{panelUnread} unread</span>
            </div>
          </div>
          {loading ? (
            <p className="p-6 text-center font-body text-xs text-[#6B6B68]">Loading…</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12">
              <Bell className="h-8 w-8 text-[#E8E8E4]" strokeWidth={1.25} />
              <p className="font-body text-sm text-[#6B6B68]">All caught up!</p>
            </div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id} className="border-b border-[#F5F5F3]">
                  <button
                    type="button"
                    className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors ${
                      !n.isRead ? "border-l-[3px] border-l-[#37392d] bg-[#FAFAF8]" : "bg-white"
                    }`}
                    onClick={() => {
                      if (n.link) router.push(n.link);
                      setOpen(false);
                    }}
                  >
                    {iconFor(n.type)}
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[13px] font-medium text-black">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 font-body text-xs font-light text-[#6B6B68]">{n.message}</p>
                      <p className="mt-1 text-right font-body text-[11px] text-[#6B6B68]/80">
                        {timeLabel(n.createdAt.toString())}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-[#EBEBEA] py-3 text-center">
            <Link href="/admin" className="font-body text-[11px] text-[#37392d] underline" onClick={() => setOpen(false)}>
              View all activity
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
