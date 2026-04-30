"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { optimizeImageUrl } from "@/lib/utils";
import { CollectionFormModal } from "@/components/admin/CollectionFormModal";

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
  const [deleteTarget, setDeleteTarget] = useState<AdminCollectionRow | null>(null);

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
    if (!res.ok) toast.error("Update failed");
    else {
      toast.success("Saved");
      router.refresh();
    }
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
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/collections/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Delete failed");
    else {
      toast.success("Collection removed");
      setDeleteTarget(null);
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

      <div className="overflow-x-auto border border-[#EBEBEA] bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left font-body text-[13px]">
          <thead>
            <tr className="border-b border-[#EBEBEA] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">
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
                className="cursor-pointer border-b border-[#EBEBEA] last:border-0 hover:bg-[#FAFAFA]"
                onClick={() => {
                  setEditing(row);
                  setModalOpen(true);
                }}
              >
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
                    onChange={() => void patch(row.id, { isPublished: !row.isPublished })}
                    className="accent-olive"
                  />
                </td>
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    defaultValue={row.displayOrder}
                    className="w-14 border border-[#EBEBEA] bg-white px-2 py-1 text-[12px]"
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
                      onClick={() => setDeleteTarget(row)}
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

      <AlertDialog.Root open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 border border-[#EBEBEA] bg-white p-6 shadow-lg">
            <AlertDialog.Title className="font-display text-lg text-ink">
              Delete {deleteTarget?.name ?? "collection"}?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 font-body text-[13px] text-[#6B6B68]">
              Products will not be deleted, just unassigned from this collection.
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button type="button" className="border border-[#EBEBEA] px-4 py-2 text-[12px]">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  className="bg-red-700 px-4 py-2 text-[12px] text-white"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
