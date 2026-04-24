"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProductCategory, ProductType } from "@prisma/client";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Toggle } from "@/components/ui/Toggle";

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  category: ProductCategory;
  type: ProductType;
  isPublished: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  primaryImage: string | null;
  variantCount: number;
  minPriceNGN: number;
  totalStock: number;
  orderItemsCount: number;
};

type ProductsTableProps = {
  items: ProductRow[];
  page: number;
  total: number;
  perPage: number;
  search: string;
  category: string;
  type: string;
  published: string;
  stock: string;
};

type DeleteState =
  | { mode: "single"; id: string; name: string }
  | { mode: "bulk"; ids: string[] }
  | null;

function formatNGN(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export function ProductsTable({
  items,
  page,
  total,
  perPage,
  search: initialSearch,
  category,
  type,
  published,
  stock,
}: ProductsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const pushFilters = useCallback(
    (next: Record<string, string>) => {
      const p = new URLSearchParams(params.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (!v) p.delete(k);
        else p.set(k, v);
      });
      p.set("page", "1");
      startTransition(() => {
        router.push(`${pathname}?${p.toString()}`);
      });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (search === initialSearch) return;
      pushFilters({ search });
    }, 300);
    return () => clearTimeout(t);
  }, [search, initialSearch, pushFilters]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const patchProduct = async (id: string, body: Record<string, boolean>) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Update failed");
      return;
    }
    router.refresh();
  };

  const runDelete = async () => {
    if (!deleteState) return;
    setIsDeleting(true);
    try {
      const ids = deleteState.mode === "single" ? [deleteState.id] : deleteState.ids;
      for (const id of Array.from(ids)) {
        const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Delete failed");
          setIsDeleting(false);
          return;
        }
      }
      toast.success(deleteState.mode === "single" ? "Product deleted" : `${ids.length} products deleted`);
      setSelected(new Set());
      setDeleteState(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const allVisibleSelected = items.length > 0 && items.every((p) => selected.has(p.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((p) => p.id)));
  };

  const bulkPatch = async (body: Record<string, boolean>) => {
    if (selected.size === 0) return;
    const results = await Promise.all(
      Array.from(selected).map((id) =>
        fetch(`/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    );
    if (results.some((r) => !r.ok)) {
      toast.error("Some updates failed");
      return;
    }
    toast.success("Products updated");
    setSelected(new Set());
    router.refresh();
  };

  const deleteDescription =
    deleteState?.mode === "single"
      ? `Are you sure you want to delete "${deleteState.name}"? This cannot be undone.`
      : deleteState?.mode === "bulk"
        ? `Delete ${deleteState.ids.length} products? This cannot be undone.`
        : "";

  return (
    <div className="space-y-4">
      <AlertDialog
        open={deleteState !== null}
        onOpenChange={(o) => !o && setDeleteState(null)}
        title={deleteState?.mode === "bulk" ? "Delete products" : "Delete Product"}
        description={deleteDescription}
        variant="danger"
        confirmLabel={deleteState?.mode === "bulk" ? "Delete selected" : "Delete Product"}
        onConfirm={runDelete}
        loading={isDeleting}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-[#EBEBEA] bg-white p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or slug…"
          className="min-w-[200px] flex-1 rounded-sm border border-[#EBEBEA] bg-white px-3 py-2 text-sm text-charcoal placeholder:text-[#A8A8A4]"
        />
        <select
          value={category}
          onChange={(e) => pushFilters({ category: e.target.value })}
          className="rounded-sm border border-[#EBEBEA] bg-white px-2 py-2 text-sm text-charcoal"
        >
          <option value="">All categories</option>
          {Object.values(["BRIDAL", "EVENING_WEAR", "CASUAL", "FORMAL", "KIDDIES", "ACCESSORIES"]).map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => pushFilters({ type: e.target.value })}
          className="rounded-sm border border-[#EBEBEA] bg-white px-2 py-2 text-sm text-charcoal"
        >
          <option value="">All types</option>
          <option value="RTW">RTW</option>
          <option value="BESPOKE">Bespoke</option>
        </select>
        <select
          value={published}
          onChange={(e) => pushFilters({ published: e.target.value })}
          className="rounded-sm border border-[#EBEBEA] bg-white px-2 py-2 text-sm text-charcoal"
        >
          <option value="">All statuses</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
        <select
          value={stock}
          onChange={(e) => pushFilters({ stock: e.target.value })}
          className="rounded-sm border border-[#EBEBEA] bg-white px-2 py-2 text-sm text-charcoal"
        >
          <option value="">All stock</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border border-olive bg-olive p-3 text-sm text-white shadow-md">
          <span className="font-medium">{selected.size} selected</span>
          <button
            type="button"
            className="border border-white/40 px-3 py-1 text-xs text-white hover:bg-white/10"
            onClick={() => void bulkPatch({ isPublished: true })}
          >
            Publish
          </button>
          <button
            type="button"
            className="border border-white/40 px-3 py-1 text-xs text-white hover:bg-white/10"
            onClick={() => void bulkPatch({ isPublished: false })}
          >
            Unpublish
          </button>
          <button
            type="button"
            className="border border-white/40 px-3 py-1 text-xs text-white hover:bg-white/10"
            onClick={() => void bulkPatch({ isNewArrival: true })}
          >
            Mark as New Arrival
          </button>
          <button
            type="button"
            className="border border-white/40 px-3 py-1 text-xs text-white hover:bg-red-600/30"
            onClick={() => setDeleteState({ mode: "bulk", ids: Array.from(selected) })}
          >
            Delete selected
          </button>
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto rounded-sm border border-[#EBEBEA] bg-white px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[700px] text-left text-sm text-charcoal">
          <thead className="border-b border-[#EBEBEA] font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">
            <tr>
              <th className="w-10 p-3">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all on page" />
              </th>
              <th className="p-3">Image</th>
              <th className="p-3">Product</th>
              <th className="hidden p-3 md:table-cell">Category</th>
              <th className="hidden p-3 md:table-cell">Type</th>
              <th className="hidden p-3 lg:table-cell">Variants</th>
              <th className="p-3">Stock</th>
              <th className="hidden p-3 sm:table-cell">Featured</th>
              <th className="p-3">Published</th>
              <th className="hidden p-3 md:table-cell">New</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "border-b border-[#F5F5F3] transition-colors hover:bg-[#FAFAFA]",
                  pending && "opacity-60",
                )}
              >
                <td className="p-2">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Select ${p.name}`} />
                </td>
                <td className="p-2">
                  <div className="relative h-[52px] w-10 overflow-hidden rounded-sm border border-[#EBEBEA] bg-white">
                    {p.primaryImage ? (
                      <Image src={p.primaryImage} alt="" fill className="object-cover" sizes="40px" />
                    ) : null}
                  </div>
                </td>
                <td className="max-w-[200px] p-2">
                  <Link href={`/admin/products/${p.id}/edit`} className="block font-medium text-charcoal hover:text-olive">
                    {p.name}
                  </Link>
                  <span className="block truncate font-mono text-xs text-olive/80">{p.slug}</span>
                </td>
                <td className="hidden p-2 text-xs md:table-cell">{p.category.replace(/_/g, " ")}</td>
                <td className="hidden p-2 text-xs md:table-cell">{p.type}</td>
                <td className="hidden p-2 text-xs lg:table-cell">
                  {p.variantCount} sizes · From {formatNGN(p.minPriceNGN)}
                </td>
                <td
                  className={cn(
                    "p-2 text-xs font-medium",
                    p.totalStock === 0 ? "text-red-400" : p.totalStock < 10 ? "text-amber-300" : "text-emerald-300",
                  )}
                >
                  {p.totalStock}
                </td>
                <td className="hidden p-2 sm:table-cell">
                  <Toggle
                    checked={p.isFeatured}
                    onChange={(v) => void patchProduct(p.id, { isFeatured: v })}
                    size="sm"
                    srLabel={`Featured: ${p.name}`}
                  />
                </td>
                <td className="p-2">
                  <Toggle
                    checked={p.isPublished}
                    onChange={(v) => void patchProduct(p.id, { isPublished: v })}
                    size="sm"
                    srLabel={`Published: ${p.name}`}
                  />
                </td>
                <td className="hidden p-2 md:table-cell">
                  <Toggle
                    checked={p.isNewArrival}
                    onChange={(v) => void patchProduct(p.id, { isNewArrival: v })}
                    size="sm"
                    srLabel={`New arrival: ${p.name}`}
                  />
                </td>
                <td className="p-2">
                  <Link href={`/admin/products/${p.id}/edit`} className="text-olive hover:underline">
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="ml-3 text-red-400 hover:underline"
                    onClick={() => setDeleteState({ mode: "single", id: p.id, name: p.name })}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-[#A8A8A4]">
        <span>
          Page {page} of {totalPages} · {total} products
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-sm border border-[#E8E8E4] px-3 py-1 disabled:opacity-40"
            onClick={() => {
              const p = new URLSearchParams(params.toString());
              p.set("page", String(page - 1));
              router.push(`${pathname}?${p}`);
            }}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            className="rounded-sm border border-[#E8E8E4] px-3 py-1 disabled:opacity-40"
            onClick={() => {
              const p = new URLSearchParams(params.toString());
              p.set("page", String(page + 1));
              router.push(`${pathname}?${p}`);
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
