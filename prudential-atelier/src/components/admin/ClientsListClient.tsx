"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { LoyaltyTier } from "@prisma/client";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { Badge } from "@/components/ui/Badge";
import { formatDate, getInitials } from "@/lib/utils";

type ClientRow = {
  id: string;
  loyaltyTier: LoyaltyTier;
  totalSpend: number;
  user: { name: string | null; email: string; phone: string | null };
  bespokeOrders: { createdAt: string }[];
  _count: { bespokeOrders: number };
};

function tierBadge(tier: LoyaltyTier) {
  const map: Record<LoyaltyTier, "grey" | "gold" | "success" | "outline-gold"> = {
    BRONZE: "grey",
    SILVER: "grey",
    GOLD: "gold",
    PLATINUM: "outline-gold",
  };
  return <Badge variant={map[tier]}>{tier}</Badge>;
}

export function ClientsListClient() {
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-choc/10 font-sans text-[10px] font-medium text-choc">
              {getInitials(row.user.name ?? row.user.email)}
            </div>
            <div>
              <Link
                href={`/admin/clients/${row.id}`}
                className="font-sans text-sm font-medium text-nut hover:underline"
              >
                {row.user.name ?? row.user.email}
              </Link>
              <p className="font-sans text-xs text-text-light">{row.user.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "phone",
        header: "Phone",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">{row.user.phone ?? "—"}</span>
        ),
      },
      {
        key: "orders",
        header: "Orders",
        cell: (row) => (
          <span className="font-sans text-sm">{row._count.bespokeOrders}</span>
        ),
      },
      {
        key: "tier",
        header: "Tier",
        cell: (row) => tierBadge(row.loyaltyTier),
      },
      {
        key: "last",
        header: "Last Order",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">
            {row.bespokeOrders[0] ? formatDate(row.bespokeOrders[0].createdAt) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">CRM</p>
        <h1 className="font-display text-2xl text-ink">Clients</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Client profiles, measurements, and order history
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
            className={`rounded border px-3 py-1.5 font-sans text-xs transition-colors ${
              quickFilter === f.id
                ? "border-choc bg-choc text-cream"
                : "border-sand bg-white text-text-mid hover:border-choc/40"
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
          className="min-w-[200px] flex-1 rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
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
          emptyMessage="No clients found."
        />
      )}
    </div>
  );
}
