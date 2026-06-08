"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerNotification, CustomerNotificationType } from "@prisma/client";
import { Bell, Calendar, CreditCard, Package, Scissors, Star, Truck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type FilterType = "ALL" | "UNREAD" | "ATELIER" | "ORDERS" | "CONSULTATIONS";

const ATELIER_TYPES: CustomerNotificationType[] = ["ATELIER_STAGE_ADVANCED", "MOODBOARD_READY"];
const ORDER_TYPES: CustomerNotificationType[] = [
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CONFIRMED",
  "INVOICE_ISSUED",
  "QUOTE_READY",
  "REVIEW_REQUEST",
];
const CONSULTATION_TYPES: CustomerNotificationType[] = [
  "CONSULTATION_CONFIRMED",
  "MEETING_LINK_SENT",
  "EVENT_REMINDER",
];

function iconFor(type: CustomerNotificationType) {
  switch (type) {
    case "ATELIER_STAGE_ADVANCED":
    case "MOODBOARD_READY":
      return <Scissors size={16} className="text-choc" />;
    case "CONSULTATION_CONFIRMED":
    case "MEETING_LINK_SENT":
    case "EVENT_REMINDER":
      return <Calendar size={16} className="text-lightbr" />;
    case "ORDER_SHIPPED":
      return <Truck size={16} className="text-nut" />;
    case "ORDER_DELIVERED":
    case "ORDER_CONFIRMED":
    case "INVOICE_ISSUED":
    case "QUOTE_READY":
    case "REVIEW_REQUEST":
      return <Package size={16} className="text-nut" />;
    case "PAYMENT_CONFIRMED":
    case "BALANCE_REMINDER":
    case "BANK_TRANSFER_CONFIRMED":
      return <CreditCard size={16} className="text-success" />;
    case "LOYALTY_TIER_UPGRADE":
    case "REFERRAL_REWARD":
      return <Star size={16} className="text-nut" />;
    default:
      return <Bell size={16} className="text-text-light" />;
  }
}

function matchesFilter(row: CustomerNotification, filter: FilterType): boolean {
  if (filter === "ALL") return true;
  if (filter === "UNREAD") return !row.isRead;
  if (filter === "ATELIER") return ATELIER_TYPES.includes(row.type);
  if (filter === "ORDERS") return ORDER_TYPES.includes(row.type);
  if (filter === "CONSULTATIONS") return CONSULTATION_TYPES.includes(row.type);
  return true;
}

export function CustomerNotificationsPageClient({
  initialNotifications,
}: {
  initialNotifications: CustomerNotification[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialNotifications);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");

  const unreadCount = rows.filter((n) => !n.isRead).length;
  const filtered = useMemo(() => rows.filter((row) => matchesFilter(row, selectedFilter)), [rows, selectedFilter]);

  async function markOneRead(id: string) {
    await fetch("/api/account/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, isRead: true } : row)));
  }

  async function markAllRead() {
    await fetch("/api/account/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setRows((prev) => prev.map((row) => ({ ...row, isRead: true })));
  }

  async function openRow(row: CustomerNotification) {
    if (!row.isRead) await markOneRead(row.id);
    router.push(row.link || "/account/notifications");
  }

  const tabs: { id: FilterType; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ATELIER", label: "Atelier" },
    { id: "ORDERS", label: "Orders" },
    { id: "CONSULTATIONS", label: "Consultations" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="font-display text-2xl text-choc dark:text-cream">Notifications</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-nut/10 px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-nut">
            {unreadCount} unread
          </span>
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="rounded-sm border border-sand px-3 py-1.5 font-sans text-[11px] text-nut hover:bg-sand/30"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedFilter(tab.id)}
            className={`border-b-2 px-2 py-1.5 font-sans text-[11px] uppercase tracking-[0.08em] ${
              selectedFilter === tab.id ? "border-nut text-choc dark:text-cream" : "border-transparent text-text-light"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ul className="overflow-hidden rounded-lg border border-sand bg-ivory dark:border-sand/30 dark:bg-sidebar-bg">
        {filtered.length === 0 ? (
          <li className="p-8 text-center font-sans text-sm text-text-mid">No notifications match this filter.</li>
        ) : (
          filtered.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => void openRow(row)}
                className={`flex w-full items-start gap-3 border-b border-sand px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[rgba(152,117,91,0.06)] dark:border-sand/30 ${
                  !row.isRead ? "border-l-[3px] border-l-nut bg-[rgba(92,52,34,0.04)]" : ""
                }`}
              >
                <span className="mt-0.5">{iconFor(row.type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13px] font-medium text-choc dark:text-cream">{row.title}</p>
                  <p className="mt-0.5 font-sans text-[12px] text-text-mid">{row.message}</p>
                  <p className="mt-1 font-sans text-[11px] text-text-light">
                    {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
