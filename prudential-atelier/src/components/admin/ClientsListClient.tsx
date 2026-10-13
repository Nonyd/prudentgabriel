"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { LoyaltyTier } from "@prisma/client";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { getInitials } from "@/lib/utils";

type ClientRow = {
  id: string;
  loyaltyTier: LoyaltyTier;
  totalSpend: number;
  user: { name: string | null; email: string; phone: string | null };
  bespokeOrders: { createdAt: string; orderRef: string }[];
  _count: { bespokeOrders: number };
  name: string;
  /** Her latest commission: "Birthday dress" (or the house's own title). */
  latestTitle: string | null;
  /** Its delivery date: "15 October". */
  latestDelivery: string | null;
  /** "Mrs Azazi — Birthday dress — 15 October": the three columns as one line. */
  preview: string;
};

export function ClientsListClient() {
  const router = useRouter();
  const [items, setItems] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tier !== "all") params.set("tier", tier);
    if (quickFilter !== "all") params.set("filter", quickFilter);
    const res = await fetch(`/api/clients?${params}`);
    if (!res.ok) {
      toast.error("Failed to load clients");
      return;
    }
    const data = (await res.json()) as { items: ClientRow[] };
    setItems(data.items);
    setLoading(false);
  }, [search, tier, quickFilter]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const handleBulkDelete = async () => {
    toast.error("Bulk delete is not available for client profiles.");
  };

  const columns: BulkColumn<ClientRow>[] = useMemo(
    () => [
      {
        key: "client",
        header: "Client",
        cell: (row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-choc/10 font-sans text-10px font-medium text-choc">
              {getInitials(row.name)}
            </div>
            <Link
              href={`/admin/clients/${row.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-sans text-base font-semibold text-ink hover:underline"
            >
              {row.name}
            </Link>
          </div>
        ),
      },
      {
        key: "order",
        header: "Recent order",
        cell: (row) =>
          row.latestTitle ? (
            <span className="font-sans text-sm text-text-dark">{row.latestTitle}</span>
          ) : (
            <span className="font-sans text-sm text-text-light">No commission yet</span>
          ),
      },
      {
        key: "delivery",
        header: "Delivery",
        cell: (row) => (
          <span className="font-sans text-sm text-text-mid">{row.latestDelivery ?? "—"}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">CRM</p>
        <h1 className="admin-heading-pill glass-1 glass-pill font-display text-2xl text-ink">Clients</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Client profiles, measurements, and order history ·{" "}
          <Link href="/admin/clients/places" className="underline hover:text-nut">
            Where clients are
          </Link>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All clients" },
          { id: "vip", label: "VIP (Gold+)" },
          { id: "active_orders", label: "Active orders" },
          { id: "no_orders", label: "No orders yet" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setQuickFilter(f.id)}
            className={`admin-chip glass-1 glass-pill font-sans text-xs transition-colors ${
              quickFilter === f.id
                ? "border-[var(--glass-edge-bright)] text-choc"
                : "text-text-mid"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        >
          <option value="all">All tiers</option>
          {(["BRONZE", "SILVER", "GOLD", "PLATINUM"] as LoyaltyTier[]).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-text-mid">Loading clients…</p>
      ) : (
        <BulkSelectTable
          columns={columns}
          data={items}
          onBulkDelete={handleBulkDelete}
          onRowClick={(row) => router.push(`/admin/clients/${row.id}`)}
          rowLabel={(row) => `Open ${row.preview}`}
          emptyMessage="No clients found."
        />
      )}
    </div>
  );
}
