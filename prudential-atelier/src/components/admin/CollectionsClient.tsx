"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { optimizeImageUrl } from "@/lib/utils";
import { CollectionFormModal } from "@/components/admin/CollectionFormModal";
import { AlertDialog as ConfirmDialog } from "@/components/ui/AlertDialog";
import {
  formatUnpublishImpactMessage,
  mergeUnpublishImpacts,
  type UnpublishImpact,
} from "@/lib/collection-unpublish-impact";

export type AdminCollectionRow = {
  id: string;
  name: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  autoTag: string | null;
  season: string | null;
  year: number | null;
  isFeatured: boolean;
  isPublished: boolean;
  displayOrder: number;
  productCount: number;
};

export function CollectionsClient({ collections }: { collections: AdminCollectionRow[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCollectionRow | null>(null);
  const [deleteState, setDeleteState] = useState<{ mode: "single"; row: AdminCollectionRow } | { mode: "bulk"; ids: string[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [unpublishIds, setUnpublishIds] = useState<string[] | null>(null);
  const [unpublishMessage, setUnpublishMessage] = useState("");
  const [unpublishBusy, setUnpublishBusy] = useState(false);

  const sorted = useMemo(
    () => [...collections].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
    [collections],
  );

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      const j = (await res.json()) as { impact?: UnpublishImpact };
      if (j.impact) {
        setUnpublishIds([id]);
        setUnpublishMessage(formatUnpublishImpactMessage(j.impact));
        return;
      }
    }
    if (!res.ok) toast.error("Update failed");
    else {
      toast.success("Saved");
      router.refresh();
    }
  }

  async function applyUnpublish(ids: string[], confirmed: boolean): Promise<boolean> {
    const impacts: UnpublishImpact[] = [];
    let failed = false;
    for (const id of ids) {
      const res = await fetch(`/api/admin/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: false, confirmUnpublishProducts: confirmed }),
      });
      if (res.status === 409) {
        const j = (await res.json()) as { impact?: UnpublishImpact };
        if (j.impact) impacts.push(j.impact);
        continue;
      }
      if (!res.ok) failed = true;
    }
    if (impacts.length > 0 && !confirmed) {
      setUnpublishIds(ids);
      setUnpublishMessage(formatUnpublishImpactMessage(mergeUnpublishImpacts(impacts)));
      return false;
    }
    if (failed) {
      toast.error("Some updates failed");
      return false;
    }
    toast.success("Unpublished");
    router.refresh();
    return true;
  }

  async function swapDisplayOrder(a: AdminCollectionRow, b: AdminCollectionRow) {
    await Promise.all([
      fetch(`/api/admin/collections/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayOrder: b.displayOrder }),
      }),
      fetch(`/api/admin/collections/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayOrder: a.displayOrder }),
      }),
    ]);
    router.refresh();
  }

  function moveRow(row: AdminCollectionRow, dir: "up" | "down") {
    const idx = sorted.findIndex((r) => r.id === row.id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= sorted.length) return;
    void swapDisplayOrder(sorted[idx], sorted[j]);
  }

  async function confirmDelete() {
    if (!deleteState) return;
    const ids = deleteState.mode === "single" ? [deleteState.row.id] : deleteState.ids;
    setDeleteBusy(true);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/admin/collections/${id}`, { method: "DELETE" });
        if (!res.ok) {
          toast.error("Delete failed");
          return;
        }
      }
      toast.success(ids.length > 1 ? `${ids.length} collections removed` : "Collection removed");
      setDeleteState(null);
      setSelected(new Set());
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  const sortedIds = useMemo(() => sorted.map((r) => r.id), [sorted]);
  const allSortedSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAllSorted = () => {
    if (allSortedSelected) {
      setSelected((prev) => {
        const n = new Set(prev);
        for (const id of sortedIds) n.delete(id);
        return n;
      });
    } else {
      setSelected((prev) => new Set([...Array.from(prev), ...sortedIds]));
    }
  };

  async function bulkPublish(published: boolean) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    if (!published) {
      const ok = await applyUnpublish(ids, false);
      if (ok) setSelected(new Set());
      return;
    }
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/collections/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublished: true }),
        }),
      ),
    );
    if (results.some((r) => !r.ok)) toast.error("Some updates failed");
    else {
      toast.success("Published");
      setSelected(new Set());
      router.refresh();
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-body text-[13px] text-[#6B6B68]">{collections.length} collections</p>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white"
        >
          + Create collection
        </button>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-olive bg-olive p-3 text-sm text-white">
          <span className="font-medium">{selected.size} selected</span>
          <button type="button" className="border border-white/40 px-3 py-1 text-xs hover:bg-white/10" onClick={() => void bulkPublish(true)}>
            Publish
          </button>
          <button type="button" className="border border-white/40 px-3 py-1 text-xs hover:bg-white/10" onClick={() => void bulkPublish(false)}>
            Unpublish
          </button>
          <button
            type="button"
            className="border border-white/40 bg-red-900/40 px-3 py-1 text-xs hover:bg-red-900/60"
            onClick={() => setDeleteState({ mode: "bulk", ids: Array.from(selected) })}
          >
            Delete selected
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-sand bg-bg-card">
        <table className="w-full min-w-[900px] border-collapse text-left font-body text-[13px]">
          <thead>
            <tr className="border-b border-sand bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" checked={allSortedSelected} onChange={toggleSelectAllSorted} aria-label="Select all" />
              </th>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Cover</th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Products</th>
              <th className="px-3 py-3">Auto-tag</th>
              <th className="px-3 py-3">Season</th>
              <th className="px-3 py-3">Featured</th>
              <th className="px-3 py-3">Published</th>
              <th className="px-3 py-3">Display</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={row.id}
                className="cursor-pointer border-b border-sand last:border-0 hover:bg-[#FAFAFA]"
                onClick={() => {
                  setEditing(row);
                  setModalOpen(true);
                }}
              >
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    aria-label={`Select ${row.name}`}
                  />
                </td>
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label="Move up"
                      className="text-[#6B6B68] hover:text-ink disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => moveRow(row, "up")}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      className="text-[#6B6B68] hover:text-ink disabled:opacity-30"
                      disabled={idx === sorted.length - 1}
                      onClick={() => moveRow(row, "down")}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="relative h-16 w-12 overflow-hidden bg-[#F2F2F0]">
                    {row.coverImage ? (
                      <Image
                        src={optimizeImageUrl(row.coverImage, 200)}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <p className="font-medium text-ink">{row.name}</p>
                  <p className="text-[11px] text-[#8A8A86]">/{row.slug}</p>
                </td>
                <td className="px-3 py-2 align-middle text-[#6B6B68]">{row.productCount}</td>
                <td className="px-3 py-2 align-middle">
                  {row.autoTag ? (
                    <span className="inline-block bg-olive/10 px-2 py-0.5 font-body text-[11px] text-olive">{row.autoTag}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 align-middle text-[#6B6B68]">
                  {row.season || row.year ? (
                    <>
                      {row.season ?? ""} {row.year ?? ""}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={row.isFeatured}
                    onChange={() => void patch(row.id, { isFeatured: !row.isFeatured })}
                    className="accent-olive"
                  />
                </td>
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={row.isPublished}
                    onChange={() => {
                      if (row.isPublished) void applyUnpublish([row.id], false);
                      else void patch(row.id, { isPublished: true });
                    }}
                    className="accent-olive"
                  />
                </td>
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    defaultValue={row.displayOrder}
                    className="w-14 border border-sand bg-bg-card px-2 py-1 text-[12px]"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v) || v < 0) return;
                      if (v !== row.displayOrder) void patch(row.id, { displayOrder: v });
                    }}
                  />
                </td>
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="p-1 text-[#6B6B68] hover:text-olive"
                      aria-label="Edit"
                      onClick={() => {
                        setEditing(row);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-[#6B6B68] hover:text-red-700"
                      aria-label="Delete"
                      onClick={() => setDeleteState({ mode: "single", row })}
                    >
                      <Trash2 size={16} />
                    </button>
                    <a
                      href={`/admin/collections/${row.id}`}
                      className="ml-1 self-center font-body text-[11px] uppercase tracking-wide text-olive hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Detail
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CollectionFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        onSaved={() => {
          setModalOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={unpublishIds !== null}
        onOpenChange={(o) => {
          if (!o) {
            setUnpublishIds(null);
            setUnpublishMessage("");
          }
        }}
        title="Unpublish this collection?"
        description={unpublishMessage || "Published pieces in this collection will be hidden from the shop."}
        variant="warning"
        confirmLabel="Unpublish pieces"
        loading={unpublishBusy}
        onConfirm={async () => {
          if (!unpublishIds) return;
          setUnpublishBusy(true);
          try {
            const ok = await applyUnpublish(unpublishIds, true);
            if (ok) {
              setSelected(new Set());
              setUnpublishIds(null);
              setUnpublishMessage("");
            }
          } finally {
            setUnpublishBusy(false);
          }
        }}
      />
    </div>
  );
}
