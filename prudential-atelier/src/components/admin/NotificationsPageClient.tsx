"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminNotification, AdminNotificationType } from "@prisma/client";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CreditCard,
  Scissors,
  ShoppingCart,
  Star,
  Tag,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type FilterType = "ALL" | "UNREAD" | "ORDERS" | "BESPOKE" | "CONSULTATIONS" | "REVIEWS" | "STOCK" | "SYSTEM";

function iconFor(type: AdminNotificationType) {
  switch (type) {
    case "NEW_ORDER":
      return <ShoppingCart size={16} className="text-green-800" />;
    case "NEW_BESPOKE":
      return <Scissors size={16} className="text-purple-900" />;
    case "NEW_CONSULTATION":
      return <Calendar size={16} className="text-blue-900" />;
    case "REVIEW_PENDING":
      return <Star size={16} className="text-amber-800" />;
    case "LOW_STOCK":
      return <AlertTriangle size={16} className="text-red-800" />;
    case "PAYMENT_FAILED":
      return <CreditCard size={16} className="text-red-800" />;
    case "NEW_CUSTOMER":
      return <User size={16} className="text-green-800" />;
    case "COUPON_EXPIRING":
      return <Tag size={16} className="text-amber-800" />;
    default:
      return <Bell size={16} className="text-[#6B6B68]" />;
  }
}

function matchesFilter(row: AdminNotification, filter: FilterType): boolean {
  if (filter === "ALL") return true;
  if (filter === "UNREAD") return !row.isRead;
  if (filter === "ORDERS") return row.type === "NEW_ORDER" || row.type === "PAYMENT_FAILED";
  if (filter === "BESPOKE") return row.type === "NEW_BESPOKE";
  if (filter === "CONSULTATIONS") return row.type === "NEW_CONSULTATION";
  if (filter === "REVIEWS") return row.type === "REVIEW_PENDING";
  if (filter === "STOCK") return row.type === "LOW_STOCK" || row.type === "COUPON_EXPIRING";
  return row.type === "NEW_CUSTOMER";
}

export function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
  pageSize,
}: {
  initialNotifications: AdminNotification[];
  initialUnreadCount: number;
  pageSize: number;
}) {
  const [rows, setRows] = useState(initialNotifications);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const unreadCount = rows.filter((n) => !n.isRead).length;
  const data = useMemo(() => rows.filter((row) => matchesFilter(row, selectedFilter)), [rows, selectedFilter]);
  const pageRows = data.slice(0, pageSize);

  async function markOneRead(id: string) {
    await fetch("/api/admin/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, isRead: true } : row)));
  }

  async function markAllRead() {
    await fetch("/api/admin/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setRows((prev) => prev.map((row) => ({ ...row, isRead: true })));
  }

  const tabs: { id: FilterType; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ORDERS", label: "Orders" },
    { id: "BESPOKE", label: "Bespoke" },
    { id: "CONSULTATIONS", label: "Consultations" },
    { id: "REVIEWS", label: "Reviews" },
    { id: "STOCK", label: "Stock" },
    { id: "SYSTEM", label: "System" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] text-ink">Notifications</h1>
        <div className="flex items-center gap-2">
          <span className="bg-[#37392d] px-2 py-1 font-body text-[10px] uppercase tracking-[0.08em] text-white">{unreadCount || initialUnreadCount} unread</span>
          <button type="button" onClick={() => void markAllRead()} className="border border-[#EBEBEA] px-3 py-1.5 font-body text-xs hover:bg-[#F5F5F3]">
            Mark All Read
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedFilter(tab.id)}
            className={`border-b-2 px-2 py-1.5 font-body text-[11px] uppercase tracking-[0.08em] ${
              selectedFilter === tab.id ? "border-[#37392d] text-[#37392d]" : "border-transparent text-[#6B6B68]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-3 flex items-center gap-3 border border-[#EBEBEA] bg-white px-3 py-2 font-body text-xs">
          <button
            type="button"
            onClick={async () => {
              await Promise.all(selectedIds.map(async (id) => markOneRead(id)));
              setSelectedIds([]);
            }}
            className="text-[#37392d] hover:underline"
          >
            Mark Selected Read
          </button>
          <button
            type="button"
            onClick={() => {
              setRows((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
              setSelectedIds([]);
            }}
            className="text-red-600 hover:underline"
          >
            Delete Selected
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-[#EBEBEA] bg-white">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-[#EBEBEA] bg-[#FAFAFA]">
            <tr className="font-body text-[10px] uppercase tracking-[0.08em] text-[#6B6B68]">
              <th className="px-3 py-2 text-left" />
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Message</th>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className={`border-b border-[#F5F5F3] ${!row.isRead ? "border-l-[3px] border-l-[#37392d] bg-[#FAFAF8]" : "bg-white"}`}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={(event) => {
                      if (event.target.checked) setSelectedIds((prev) => [...prev, row.id]);
                      else setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                    }}
                  />
                </td>
                <td className="px-3 py-3">{iconFor(row.type)}</td>
                <td className="px-3 py-3 font-body text-[13px] font-medium text-ink">{row.title}</td>
                <td className="px-3 py-3 font-body text-[12px] text-[#4A4A47]">{row.message}</td>
                <td className="px-3 py-3 font-body text-[11px] text-[#6B6B68]">
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                </td>
                <td className="px-3 py-3">
                  {row.isRead ? (
                    <span className="font-body text-[10px] uppercase text-[#6B6B68]">Read</span>
                  ) : (
                    <span className="font-body text-[10px] uppercase text-[#37392d]">Unread</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {!row.isRead ? (
                    <button type="button" onClick={() => void markOneRead(row.id)} className="mr-3 font-body text-[11px] text-[#37392d] hover:underline">
                      Mark Read
                    </button>
                  ) : null}
                  <Link href={row.link || "/admin"} className="font-body text-[11px] text-[#37392d] hover:underline">
                    Go to →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
