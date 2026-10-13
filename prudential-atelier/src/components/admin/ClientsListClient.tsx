"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { LoyaltyTier } from "@prisma/client";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { getInitials } from "@/lib/utils";
import { CascadeConfirmDialog } from "@/components/admin/ProductCascadeDialog";
import {
  clientDialogCopy,
  type ClientCascadePreview,
  type ClientCascadeResult,
} from "@/lib/client-cascade-copy";

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

  // Bulk delete: the cascade preview counts what goes with each client first.
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<(ClientCascadePreview & { actorEmail?: string | null }) | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const clearSelectionRef = useRef<(() => void) | null>(null);

  const closeDelete = () => {
    setDeleteIds(null);
    setPreview(null);
    setDeleteError(null);
  };

  const requestBulkDelete = async (ids: string[], clearSelection: () => void) => {
    clearSelectionRef.current = clearSelection;
    setDeleteIds(ids);
    setPreview(null);
    setDeleteError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/clients/cascade/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json()) as ClientCascadePreview & { actorEmail?: string | null; error?: string };
      if (!res.ok) setDeleteError(data.error ?? "Could not check what is attached");
      else setPreview(data);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not check what is attached");
    } finally {
      setPreviewLoading(false);
    }
  };

  const runBulkDelete = async (confirmation?: string) => {
    if (!deleteIds) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/clients/cascade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deleteIds, confirmation }),
      });
      const data = (await res.json()) as {
        error?: string;
        deleted?: number;
        results?: ClientCascadeResult[];
      };
      if (!res.ok) {
        setDeleteError(data.error ?? "Delete failed");
        return;
      }
      const results = data.results ?? [];
      const ok = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      if (ok.length) {
        toast.success(ok.length === 1 ? `${ok[0].name} deleted` : `${ok.length} clients deleted`);
      }
      for (const f of failed) toast.error(`${f.name}: ${f.error ?? "not deleted"}`);
      clearSelectionRef.current?.();
      closeDelete();
      await refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    // Not reached: onBulkDeleteRequest opens the cascade preview instead of the generic confirm.
    await requestBulkDelete(ids, () => undefined);
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
          onBulkDeleteRequest={(ids, clear) => void requestBulkDelete(ids, clear)}
          onRowClick={(row) => router.push(`/admin/clients/${row.id}`)}
          rowLabel={(row) => `Open ${row.preview}`}
          emptyMessage="No clients found."
        />
      )}

      <CascadeConfirmDialog
        open={deleteIds !== null}
        copy={preview ? clientDialogCopy(preview, preview.actorEmail) : null}
        loadingPreview={previewLoading}
        submitting={deleting}
        error={deleteError}
        onOpenChange={(o) => {
          if (!o && !deleting) closeDelete();
        }}
        onConfirm={(confirmation) => void runBulkDelete(confirmation)}
      />
    </div>
  );
}
