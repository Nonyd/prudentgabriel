"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { optimizeImageUrl } from "@/lib/utils";
import type { CollectionProductWithMeta } from "@/lib/collection-products";
import { CollectionFormModal } from "@/components/admin/CollectionFormModal";
import type { AdminCollectionRow } from "@/components/admin/CollectionsClient";

type ManualRow = {
  id: string;
  productId: string;
  sortOrder: number;
  product: CollectionProductWithMeta;
};

export function CollectionDetailAdmin({
  collection,
  manualRows,
  autoProducts,
  totalUnique,
  publishedManual,
  draftManual,
}: {
  collection: {
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
    createdAt: string;
    updatedAt: string;
  };
  manualRows: ManualRow[];
  autoProducts: CollectionProductWithMeta[];
  totalUnique: number;
  publishedManual: number;
  draftManual: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "auto" | "all">("manual");
  const [modalOpen, setModalOpen] = useState(false);
  const [manualOrder, setManualOrder] = useState(manualRows);

  useEffect(() => {
    setManualOrder(manualRows);
  }, [manualRows]);

  const editingRow: AdminCollectionRow | null = useMemo(
    () => ({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      excerpt: collection.excerpt,
      coverImage: collection.coverImage,
      autoTag: collection.autoTag,
      season: collection.season,
      year: collection.year,
      isFeatured: collection.isFeatured,
      isPublished: collection.isPublished,
      displayOrder: collection.displayOrder,
      productCount: totalUnique,
    }),
    [collection, totalUnique],
  );

  const allProducts = useMemo(() => {
    const map = new Map<string, CollectionProductWithMeta>();
    for (const m of manualOrder) map.set(m.product.id, m.product);
    for (const p of autoProducts) if (!map.has(p.id)) map.set(p.id, p);
    return [...map.values()];
  }, [manualOrder, autoProducts]);

  async function persistOrder(ids: string[]) {
    const res = await fetch(`/api/admin/collections/${collection.id}/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedProductIds: ids }),
    });
    if (!res.ok) toast.error("Reorder failed");
    else {
      toast.success("Order saved");
      router.refresh();
    }
  }

  function moveManual(productId: string, dir: "up" | "down") {
    const idx = manualOrder.findIndex((m) => m.productId === productId);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= manualOrder.length) return;
    const newOrder = [...manualOrder];
    const tmp = newOrder[idx];
    newOrder[idx] = newOrder[j];
    newOrder[j] = tmp;
    setManualOrder(newOrder);
    void persistOrder(newOrder.map((m) => m.productId));
  }

  async function removeManual(productId: string) {
    const res = await fetch(`/api/admin/collections/${collection.id}/products?productId=${encodeURIComponent(productId)}`, {
      method: "DELETE",
    });
    if (!res.ok) toast.error("Remove failed");
    else {
      toast.success("Removed");
      router.refresh();
    }
  }

  const listForTab =
    tab === "manual" ? manualOrder.map((m) => m.product) : tab === "auto" ? autoProducts : allProducts;

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/collections" className="font-body text-[12px] text-olive hover:underline">
            ← Collections
          </Link>
          <h1 className="mt-2 font-display text-2xl text-ink">{collection.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="border border-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-[#37392d]"
          >
            Edit collection
          </button>
          <a
            href={`/collections/${collection.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white"
          >
            View on site ↗
          </a>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex gap-4 border-b border-[#EBEBEA] font-body text-[12px]">
            {(
              [
                ["manual", `Manual (${manualOrder.length})`],
                ["auto", `Auto-tag (${autoProducts.length})`],
                ["all", `All (${totalUnique})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 pb-2 ${tab === k ? "border-olive text-ink" : "border-transparent text-[#6B6B68]"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "auto" && !collection.autoTag ? (
            <p className="mt-6 font-body text-[13px] text-[#6B6B68]">No auto-tag set. Edit collection to add one.</p>
          ) : tab === "auto" && collection.autoTag ? (
            <p className="mt-4 font-body text-[12px] text-[#6B6B68]">
              {autoProducts.length} products auto-included via tag: <span className="text-olive">{collection.autoTag}</span>
            </p>
          ) : null}

          <ul className="mt-6 divide-y divide-[#EBEBEA] border border-[#EBEBEA] bg-white">
            {listForTab.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                {tab === "manual" ? (
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button type="button" className="text-[#6B6B68] hover:text-ink" aria-label="Up" onClick={() => moveManual(p.id, "up")}>
                      ↑
                    </button>
                    <button type="button" className="text-[#6B6B68] hover:text-ink" aria-label="Down" onClick={() => moveManual(p.id, "down")}>
                      ↓
                    </button>
                  </div>
                ) : null}
                <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-[#F2F2F0]">
                  {p.images[0]?.url ? (
                    <Image src={optimizeImageUrl(p.images[0].url, 120)} alt="" fill className="object-cover" sizes="44px" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[13px] font-medium text-ink">{p.name}</p>
                  <p className="font-body text-[11px] text-[#6B6B68]">From ₦{Math.round(p.basePriceNGN).toLocaleString()}</p>
                </div>
                {tab === "manual" ? (
                  <button
                    type="button"
                    onClick={() => void removeManual(p.id)}
                    className="shrink-0 font-body text-[11px] uppercase text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <aside className="space-y-4 border border-[#EBEBEA] bg-[#FAFAFA] p-4">
          <div>
            <p className="font-body text-[11px] uppercase text-[#6B6B68]">Total products</p>
            <p className="font-display text-2xl text-ink">{totalUnique}</p>
          </div>
          <div>
            <p className="font-body text-[11px] uppercase text-[#6B6B68]">Published manual</p>
            <p className="text-[13px]">{publishedManual}</p>
            <p className="mt-2 font-body text-[11px] uppercase text-[#6B6B68]">Draft / unpubl. manual</p>
            <p className="text-[13px]">{draftManual}</p>
          </div>
          <div>
            <p className="font-body text-[11px] uppercase text-[#6B6B68]">Cover</p>
            <div className="relative mt-2 aspect-[3/4] w-full bg-[#EEE]">
              {collection.coverImage ? (
                <Image src={optimizeImageUrl(collection.coverImage, 400)} alt="" fill className="object-cover" sizes="280px" />
              ) : null}
            </div>
            <button type="button" onClick={() => setModalOpen(true)} className="mt-2 font-body text-[11px] text-olive hover:underline">
              Edit cover
            </button>
          </div>
          <p className="text-[11px] text-[#6B6B68]">Created {new Date(collection.createdAt).toLocaleDateString()}</p>
          <p className="text-[11px] text-[#6B6B68]">Updated {new Date(collection.updatedAt).toLocaleDateString()}</p>
        </aside>
      </div>

      <CollectionFormModal open={modalOpen} onOpenChange={setModalOpen} editing={editingRow} onSaved={() => router.refresh()} />
    </div>
  );
}
