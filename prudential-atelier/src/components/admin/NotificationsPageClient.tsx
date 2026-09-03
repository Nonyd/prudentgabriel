"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminNotificationType } from "@prisma/client";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Calendar,
  CreditCard,
  Scissors,
  ShoppingCart,
  Star,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AdminNotificationRow } from "@/lib/admin-notification-access";

type FilterType =
  | "ALL"
  | "UNREAD"
  | "ACKNOWLEDGED"
  | "ORDERS"
  | "OVERSELL"
  | "BESPOKE"
  | "CONSULTATIONS"
  | "REVIEWS"
  | "STOCK"
  | "SYSTEM";

function iconFor(type: AdminNotificationType) {
  switch (type) {
    case "NEW_ORDER":
      return <ShoppingCart size={16} className="text-success" />;
    case "BANK_TRANSFER_RECEIPT":
      return <Banknote size={16} className="text-nut" />;
    case "NEW_BESPOKE":
    case "QUOTE_APPROVED":
    case "STAGE_COMPLETED":
    case "PRODUCTION_UNLOCKED":
    case "PRODUCTION_RELOCKED":
    case "STAGE_APPROVAL_RESPONSE":
      return <Scissors size={16} className="text-choc" />;
    case "NEW_CONSULTATION":
    case "CONSULTATION_COMPLETED":
    case "CONSULTATION_BOOKED_PRUDENT":
    case "QUOTE_AWAITING":
      return <Calendar size={16} className="text-lightbr" />;
    case "REVIEW_PENDING":
    case "TESTIMONIAL_SUBMITTED":
      return <Star size={16} className="text-warning" />;
    case "LOW_STOCK":
      return <AlertTriangle size={16} className="text-danger" />;
    case "PAYMENT_FAILED":
      return <CreditCard size={16} className="text-danger" />;
    case "RTW_OVERSELL":
      return <Banknote size={16} className="text-danger" />;
    case "NEW_CUSTOMER":
      return <User size={16} className="text-success" />;
    default:
      return <Bell size={16} className="text-text-light" />;
  }
}

function matchesFilter(row: AdminNotificationRow, filter: FilterType): boolean {
  if (filter === "ALL") return !row.acknowledgedAt;
  if (filter === "UNREAD") return !row.isRead && !row.acknowledgedAt;
  if (filter === "ACKNOWLEDGED") return Boolean(row.acknowledgedAt);
  if (filter === "ORDERS") return row.type === "NEW_ORDER" || row.type === "PAYMENT_FAILED" || row.type === "BANK_TRANSFER_RECEIPT";
  if (filter === "OVERSELL") return row.type === "RTW_OVERSELL";
  if (filter === "BESPOKE")
    return (
      row.type === "NEW_BESPOKE" ||
      row.type === "QUOTE_APPROVED" ||
      row.type === "STAGE_COMPLETED" ||
      row.type === "PRODUCTION_UNLOCKED" ||
      row.type === "PRODUCTION_RELOCKED" ||
      row.type === "STAGE_APPROVAL_RESPONSE"
    );
  if (filter === "CONSULTATIONS")
    return (
      row.type === "NEW_CONSULTATION" ||
      row.type === "CONSULTATION_COMPLETED" ||
      row.type === "CONSULTATION_BOOKED_PRUDENT" ||
      row.type === "QUOTE_AWAITING"
    );
  if (filter === "REVIEWS") return row.type === "REVIEW_PENDING" || row.type === "TESTIMONIAL_SUBMITTED";
  if (filter === "STOCK") return row.type === "LOW_STOCK";
  return (
    row.type === "NEW_CUSTOMER" ||
    row.type === "CONTACT_FORM" ||
    row.type === "JOB_APPLICATION" ||
    row.type === "EMAIL_DEAD" ||
    row.type === "EMAIL_PROVIDER_AUTH"
  );
}

export function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
  pageSize,
}: {
  initialNotifications: AdminNotificationRow[];
  initialUnreadCount: number;
  pageSize: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialNotifications);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");
  const [page, setPage] = useState(1);

  const unreadCount = rows.filter((n) => !n.isRead && !n.acknowledgedAt).length;
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
    setRows((prev) => prev.map((row) => (row.acknowledgedAt ? row : { ...row, isRead: true })));
  }

  async function acknowledge(id: string) {
    await fetch("/api/admin/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acknowledge: true }),
    });
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, isRead: true, acknowledgedAt: new Date(), acknowledgedByName: row.acknowledgedByName ?? "You" }
          : row,
      ),
    );
  }

  async function openRow(row: AdminNotificationRow) {
    if (!row.isRead) await markOneRead(row.id);
    router.push(row.link || "/admin/notifications");
  }

  const tabs: { id: FilterType; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: "Unread" },
    { id: "ACKNOWLEDGED", label: "Picked up" },
    { id: "ORDERS", label: "Orders" },
    { id: "OVERSELL", label: "Refund required" },
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
              <div
                className={`flex w-full items-start gap-3 border-b border-sand px-4 py-4 last:border-b-0 ${
                  !row.isRead && !row.acknowledgedAt ? "border-l-[3px] border-l-nut bg-[rgba(92,52,34,0.04)]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => void openRow(row)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:opacity-80"
                >
                  <span className="mt-0.5">{iconFor(row.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[13px] font-medium text-choc">{row.title}</p>
                    <p className="mt-0.5 font-sans text-[12px] text-text-mid">{row.message}</p>
                    <p className="mt-1 font-sans text-[11px] text-text-light">
                      {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                      {row.acknowledgedByName
                        ? ` · Picked up by ${row.acknowledgedByName}`
                        : ""}
                    </p>
                  </div>
                  {!row.isRead && !row.acknowledgedAt ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-nut" /> : null}
                </button>
                {!row.acknowledgedAt ? (
                  <button
                    type="button"
                    onClick={() => void acknowledge(row.id)}
                    className="shrink-0 rounded-sm border border-sand px-2 py-1 font-sans text-[10px] uppercase tracking-[0.08em] text-nut hover:bg-sand/30"
                  >
                    Pick up
                  </button>
                ) : null}
              </div>
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
