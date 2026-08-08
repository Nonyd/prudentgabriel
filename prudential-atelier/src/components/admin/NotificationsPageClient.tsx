"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      return <ShoppingCart size={16} className="text-success" />;
    case "NEW_BESPOKE":
      return <Scissors size={16} className="text-choc" />;
    case "NEW_CONSULTATION":
      return <Calendar size={16} className="text-lightbr" />;
    case "REVIEW_PENDING":
      return <Star size={16} className="text-warning" />;
    case "LOW_STOCK":
      return <AlertTriangle size={16} className="text-danger" />;
    case "PAYMENT_FAILED":
      return <CreditCard size={16} className="text-danger" />;
    case "NEW_CUSTOMER":
      return <User size={16} className="text-success" />;
    case "COUPON_EXPIRING":
      return <Tag size={16} className="text-warning" />;
    default:
      return <Bell size={16} className="text-text-light" />;
  }
}

function matchesFilter(row: AdminNotification, filter: FilterType): boolean {
  if (filter === "ALL") return true;
  if (filter === "UNREAD") return !row.isRead;
  if (filter === "ORDERS") return row.type === "NEW_ORDER" || row.type === "PAYMENT_FAILED";
  if (filter === "BESPOKE") return row.type === "NEW_BESPOKE";
  if (filter === "CONSULTATIONS")
    return row.type === "NEW_CONSULTATION" || row.type === "QUOTE_AWAITING";
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
  const router = useRouter();
  const [rows, setRows] = useState(initialNotifications);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");
  const [page, setPage] = useState(1);

  const unreadCount = rows.filter((n) => !n.isRead).length;
  const filtered = useMemo(() => rows.filter((row) => matchesFilter(row, selectedFilter)), [rows, selectedFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

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

  async function openRow(row: AdminNotification) {
    if (!row.isRead) await markOneRead(row.id);
    router.push(row.link || "/admin/notifications");
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
        <h1 className="admin-topbar-title font-serif font-medium text-choc">Notifications</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-nut/10 px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-nut">
            {unreadCount || initialUnreadCount} unread
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
            onClick={() => {
              setSelectedFilter(tab.id);
              setPage(1);
            }}
            className={`border-b-2 px-2 py-1.5 font-sans text-[11px] uppercase tracking-[0.08em] ${
              selectedFilter === tab.id ? "border-nut text-choc" : "border-transparent text-text-light"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ul className="overflow-hidden rounded-lg border border-sand bg-ivory">
        {pageRows.length === 0 ? (
          <li className="p-8 text-center font-sans text-sm text-text-mid">No notifications match this filter.</li>
        ) : (
          pageRows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => void openRow(row)}
                className={`flex w-full items-start gap-3 border-b border-sand px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[rgba(152,117,91,0.06)] ${
                  !row.isRead ? "border-l-[3px] border-l-nut bg-[rgba(92,52,34,0.04)]" : ""
                }`}
              >
                <span className="mt-0.5">{iconFor(row.type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[13px] font-medium text-choc">{row.title}</p>
                  <p className="mt-0.5 font-sans text-[12px] text-text-mid">{row.message}</p>
                  <p className="mt-1 font-sans text-[11px] text-text-light">
                    {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!row.isRead ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-nut" /> : null}
              </button>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between font-sans text-[11px] text-text-mid">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-sm border border-sand px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-sm border border-sand px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <Link href="/admin" className="mt-6 inline-block font-sans text-[11px] text-nut hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}
